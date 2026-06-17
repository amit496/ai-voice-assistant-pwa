import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const text = req.body?.text;
    console.log('/api/voice request body length', (text || '').length);
    if (!text) return res.status(400).json({ error: 'missing text' });

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
      console.error('/api/voice ElevenLabs not configured', { hasKey: !!ELEVENLABS_API_KEY, hasVoiceId: !!ELEVENLABS_VOICE_ID });
      return res.status(500).json({ error: 'ElevenLabs is not configured' });
    }

    console.log('/api/voice calling ElevenLabs', { voiceId: ELEVENLABS_VOICE_ID });
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      { text, model: 'eleven_monolingual_v1', voice_settings: { stability: 0.65, similarity_boost: 0.75 } },
      { headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, responseType: 'arraybuffer' }
    );

    console.log('/api/voice ElevenLabs response length', response.data?.byteLength);
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(response.data);
  } catch (err) {
    console.error('/api/voice ElevenLabs error', err?.response?.status, err?.response?.data || err.message || err);
    return res.status(500).json({ error: err?.response?.data?.error?.message || 'ElevenLabs request failed' });
  }
}
