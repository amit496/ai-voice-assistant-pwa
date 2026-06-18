import {
  getAgentId,
  getElevenLabsModel,
  isAgentEnabled,
  isElevenLabsEnabled,
} from './elevenlabsShared.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentEnabled = isAgentEnabled();

  return res.json({
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    elevenLabsEnabled: isElevenLabsEnabled(),
    elevenLabsModel: getElevenLabsModel(),
    agentEnabled,
    agentId: agentEnabled ? getAgentId() : null,
    voiceMode: agentEnabled ? 'agent' : isElevenLabsEnabled() ? 'tts' : 'browser',
  });
}
