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
    console.log('/api/chat request body length', {
      rawLength: String(rawMessage || '').length,
      length: message.length,
    });

    if (!message) {
      return res.status(400).json({ error: 'missing message', reply: 'Please enter a message.' });
    }

    const GROQ_KEY = process.env.GROQ_API_KEY;
    const GROQ_MODEL = process.env.GROQ_MODEL || FALLBACK_GROQ_MODEL;

    if (!GROQ_KEY) {
      console.warn('/api/chat no GROQ key configured, echoing message');
      return res.json({ reply: `Echo: ${message}` });
    }

    const callGroq = (model) =>
      axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model, messages: [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, { role: 'user', content: message }], max_tokens: MAX_REPLY_TOKENS },
        { headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' } }
      );

    console.log('/api/chat calling Groq', { model: GROQ_MODEL });
    let response;
    try {
      response = await callGroq(GROQ_MODEL);
    } catch (err) {
      const isTooLarge =
        err?.response?.status === 413 ||
        err?.response?.data?.error?.code === 'request_too_large';
      if (isTooLarge && GROQ_MODEL !== FALLBACK_GROQ_MODEL) {
        console.warn('/api/chat model too large, retrying with', FALLBACK_GROQ_MODEL);
        response = await callGroq(FALLBACK_GROQ_MODEL);
      } else {
        throw err;
      }
    }

    console.log('/api/chat Groq response', response.data || '(no data)');
    const reply = response.data?.choices?.[0]?.message?.content || '(no reply)';
    return res.json({ reply });
  } catch (err) {
    console.error('/api/chat error', err?.response?.status, err?.response?.data || err.message || err);
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.error?.message;
    const reply =
      status === 413 || /entity too large/i.test(apiMessage || '')
        ? 'Your question is too long. Please ask a shorter question.'
        : apiMessage || 'Error generating reply';
    return res.status(status === 413 ? 413 : 500).json({ reply, error: reply });
  }
}
