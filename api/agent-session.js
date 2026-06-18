import { getAgentId, isAgentEnabled } from './elevenlabsShared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = getAgentId();
  if (!isAgentEnabled()) {
    return res.status(503).json({ error: 'ElevenLabs agent is not configured.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (response.ok) {
      const body = await response.json();
      return res.json({ signedUrl: body.signed_url, agentId });
    }

    const errorBody = await response.json().catch(() => ({}));
    const missingConvaiPermission =
      response.status === 401 &&
      (errorBody?.detail?.message || '').includes('convai');

    if (missingConvaiPermission || response.status === 401) {
      return res.json({
        agentId,
        usePublicAgent: true,
        note: 'Using public agent mode. Enable ConvAI permission on your API key for signed URLs.',
      });
    }

    return res.status(response.status).json({
      error: errorBody?.detail?.message || 'Failed to create agent session',
    });
  } catch (err) {
    console.error('/api/agent-session error', err);
    return res.status(500).json({ error: 'Failed to create agent session' });
  }
}
