const DEFAULT_MODEL = 'eleven_flash_v2_5';

export function getElevenLabsModel() {
  return process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;
}

export function getAgentId() {
  return process.env.ELEVENLABS_AGENT_ID || '';
}

export function isAgentEnabled() {
  if (process.env.ELEVENLABS_AGENT_ENABLED === 'false') return false;
  const enabled = Boolean(getAgentId() && process.env.ELEVENLABS_API_KEY);
  if (enabled) console.log('✅ [ELEVENLABS] Conversational AI Agent ENABLED');
  return enabled;
}

export function isElevenLabsEnabled() {
  if (process.env.ELEVENLABS_ENABLED === 'false') return false;
  const enabled = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
  if (enabled) console.log('✅ [ELEVENLABS] Text-to-Speech (TTS) ENABLED');
  return enabled;
}

export function parseElevenLabsError(err) {
  const status = err?.response?.status;
  const raw = err?.response?.data;

  let parsed = null;
  if (raw instanceof ArrayBuffer) {
    try {
      parsed = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      parsed = null;
    }
  } else if (Buffer.isBuffer(raw)) {
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      parsed = null;
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  }

  const code = parsed?.detail?.status || parsed?.status;
  const message = parsed?.detail?.message || parsed?.message || err.message;

  if (status === 401) {
    return {
      status: 401,
      error:
        code === 'missing_permissions'
          ? 'ElevenLabs API key lacks Text to Speech access. In elevenlabs.io → API Keys → set Text to Speech to Access.'
          : message || 'ElevenLabs API key rejected (401). Check ELEVENLABS_API_KEY in server/.env.',
      skipElevenLabs: true,
    };
  }

  if (status === 402) {
    const isPaidPlanVoice =
      code === 'paid_plan_required' ||
      /library voices via the api/i.test(message || '');
    return {
      status: 402,
      error: isPaidPlanVoice
        ? 'This voice requires a paid ElevenLabs plan via API. On the free plan use a Default voice (e.g. Bella EXAVITQu4vr4xnSDxMaL or Adam pNInz6obpgDQGcFmaJgB) in ELEVENLABS_VOICE_ID.'
        : message || 'ElevenLabs payment required. Check credits or subscription at elevenlabs.io.',
      skipElevenLabs: false,
    };
  }

  if (status === 404) {
    return {
      status: 404,
      error: 'ElevenLabs voice ID not found. Check ELEVENLABS_VOICE_ID in server/.env.',
    };
  }

  if (status === 429) {
    return {
      status: 429,
      error: 'ElevenLabs quota exceeded. Using device voice instead.',
      skipElevenLabs: true,
    };
  }

  return {
    status: status || 500,
    error: message || 'ElevenLabs request failed',
    skipElevenLabs: status === 401 || status === 402 || status === 429,
  };
}
