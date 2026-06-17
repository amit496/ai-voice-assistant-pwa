import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const message = req.body?.message;
    console.log('/api/chat request body length', (message || '').length);
    if (!message) return res.status(400).json({ error: 'missing message' });

    const GROQ_KEY = process.env.GROQ_API_KEY;
    const GROQ_MODEL = process.env.GROQ_MODEL || 'groq/compound';

    const MAX_MESSAGE_LENGTH = 5000;
    let _msg = message;
    if (_msg.length > MAX_MESSAGE_LENGTH) {
      console.warn('/api/chat message too large, truncating', _msg.length);
      _msg = _msg.slice(0, MAX_MESSAGE_LENGTH);
    }

    if (!GROQ_KEY) {
      console.warn('/api/chat no GROQ key configured, echoing message');
      return res.json({ reply: `Echo: ${_msg}` });
    }

    console.log('/api/chat calling Groq', { model: GROQ_MODEL });
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: GROQ_MODEL, messages: [{ role: 'user', content: _msg }], max_tokens: 150 },
      { headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );

    console.log('/api/chat Groq response', response.data || '(no data)');
    const reply = response.data?.choices?.[0]?.message?.content || '(no reply)';
    return res.json({ reply });
  } catch (err) {
    console.error('/api/chat error', err?.response?.status, err?.response?.data || err.message || err);
    const reply = err?.response?.data?.error?.message || 'Error generating reply';
    return res.status(500).json({ reply });
  }
}
