import { getAgentId, isAgentEnabled } from './elevenlabsShared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = getAgentId();
  console.log('🎙️ [AGENT SESSION] Starting agent session request...', { agentId });

  if (!isAgentEnabled()) {
    console.error('❌ [AGENT SESSION] Agent not configured');
    return res.status(503).json({ error: 'ElevenLabs agent is not configured.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    console.log('📡 [AGENT SESSION] Fetching signed URL from ElevenLabs...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (response.ok) {
      const body = await response.json();
      console.log('✅ [AGENT SESSION] Signed URL obtained successfully');
      return res.json({ signedUrl: body.signed_url, agentId });
    }

    const errorBody = await response.json().catch(() => ({}));
    const missingConvaiPermission =
      response.status === 401 &&
      (errorBody?.detail?.message || '').includes('convai');

    if (missingConvaiPermission || response.status === 401) {
      console.warn('⚠️ [AGENT SESSION] 401 Unauthorized - ConvAI permission missing', {
        status: response.status,
        message: errorBody?.detail?.message,
      });
      return res.json({
        agentId,
        usePublicAgent: true,
        note: 'Using public agent mode. Enable ConvAI permission on your API key for signed URLs.',
      });
    }

    console.error('❌ [AGENT SESSION] Failed to create session', {
      status: response.status,
      error: errorBody?.detail?.message,
    });
    return res.status(response.status).json({
      error: errorBody?.detail?.message || 'Failed to create agent session',
    });
  } catch (err) {
    console.error('❌ [AGENT SESSION] Error', {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Failed to create agent session' });
  }
}
