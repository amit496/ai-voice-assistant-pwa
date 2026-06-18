import axios from 'axios';
import { getElevenLabsModel, isElevenLabsEnabled, parseElevenLabsError } from './elevenlabsShared.js';

const MAX_VOICE_TEXT_LENGTH = 2500;

function trimText(text, maxLength = MAX_VOICE_TEXT_LENGTH) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const text = trimText(req.body?.text);
    console.log('/api/voice request body length', (text || '').length);
    if (!text) return res.status(400).json({ error: 'missing text' });

    if (!isElevenLabsEnabled()) {
      return res.status(503).json({
        error: 'ElevenLabs is disabled. Set ELEVENLABS_ENABLED=true and API keys to enable.',
        skipElevenLabs: true,
      });
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
      console.error('/api/voice ElevenLabs not configured', {
        hasKey: !!ELEVENLABS_API_KEY,
        hasVoiceId: !!ELEVENLABS_VOICE_ID,
      });
      return res.status(500).json({
        error:
          'ElevenLabs is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in Vercel env vars.',
      });
    }

    const model = getElevenLabsModel();
    console.log('/api/voice calling ElevenLabs', { voiceId: ELEVENLABS_VOICE_ID, model });
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text,
        model_id: model,
        voice_settings: { stability: 0.65, similarity_boost: 0.75 },
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      }
    );

    console.log('/api/voice ElevenLabs response length', response.data?.byteLength);
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(response.data);
  } catch (err) {
    const { status, error, skipElevenLabs } = parseElevenLabsError(err);
    console.error('/api/voice ElevenLabs error', status, error);
    return res.status(status).json({ error, skipElevenLabs });
  }
}
