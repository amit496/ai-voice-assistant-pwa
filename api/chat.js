import axios from 'axios';

const MAX_MESSAGE_LENGTH = 3000;
const FALLBACK_GROQ_MODEL = 'llama-3.3-70b-versatile';
const VOICE_SYSTEM_PROMPT =
  'You are Nova, a voice-first AI assistant. Reply in short, plain sentences only. No markdown, no tables, no bullet lists, no headings. Keep answers to 2-4 brief sentences suitable for speaking aloud. Be direct and conversational.';
const MAX_REPLY_TOKENS = 200;

function trimMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
  if (!message) return '';
  const trimmed = String(message).trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawMessage = req.body?.message;
    const message = trimMessage(rawMessage);
    console.log('💬 [CHAT] Request received', {
      rawLength: String(rawMessage || '').length,
      trimmedLength: message.length,
    });

    if (!message) {
      return res.status(400).json({ error: 'missing message', reply: 'Please enter a message.' });
    }

    const GROQ_KEY = process.env.GROQ_API_KEY;
    const GROQ_MODEL = process.env.GROQ_MODEL || FALLBACK_GROQ_MODEL;

    if (!GROQ_KEY) {
      console.warn('⚠️ [CHAT] GROQ_API_KEY not configured - using echo fallback');
      return res.json({ reply: `Echo: ${message}` });
    }

    console.log('📡 [CHAT] Calling Groq API', { model: GROQ_MODEL });

    const callGroq = (model) =>
      axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model, messages: [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, { role: 'user', content: message }], max_tokens: MAX_REPLY_TOKENS },
        { headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' } }
      );

    let response;
    try {
      response = await callGroq(GROQ_MODEL);
    } catch (err) {
      const isTooLarge =
        err?.response?.status === 413 ||
        err?.response?.data?.error?.code === 'request_too_large';
      if (isTooLarge && GROQ_MODEL !== FALLBACK_GROQ_MODEL) {
        console.warn('⚠️ [CHAT] Model too large, retrying with fallback', FALLBACK_GROQ_MODEL);
        response = await callGroq(FALLBACK_GROQ_MODEL);
      } else {
        throw err;
      }
    }

    const reply = response.data?.choices?.[0]?.message?.content || '(no reply)';
    console.log('✅ [CHAT] Groq response received', { replyLength: reply.length });
    return res.json({ reply });
  } catch (err) {
    console.error('❌ [CHAT] Error', {
      status: err?.response?.status,
      message: err?.response?.data?.error?.message || err.message,
      fullError: err?.response?.data,
    });
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.error?.message;
    const reply =
      status === 413 || /entity too large/i.test(apiMessage || '')
        ? 'Your question is too long. Please ask a shorter question.'
        : apiMessage || 'Error generating reply';
    return res.status(status === 413 ? 413 : 500).json({ reply, error: reply });
  }
}
