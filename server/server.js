import 'dotenv/config';
import express from "express";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import { ElevenLabsClient } from "elevenlabs";
import {
  getAgentId,
  getElevenLabsModel,
  isAgentEnabled,
  isElevenLabsEnabled,
  parseElevenLabsError,
} from "../api/elevenlabsShared.js";

const VOICE_SYSTEM_PROMPT =
  "You are Nova, a voice-first AI assistant. Reply in short, plain sentences only. No markdown, no tables, no bullet lists, no headings. Keep answers to 2-4 brief sentences suitable for speaking aloud. Be direct and conversational.";

const MAX_MESSAGE_LENGTH = 3000;
const MAX_REPLY_TOKENS = 200;
const MAX_VOICE_TEXT_LENGTH = 2500;
const JSON_BODY_LIMIT = "2mb";

function trimMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
  if (!message) return "";
  const trimmed = String(message).trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT, extended: true }));

// Multer for in-memory audio file uploads (max 10MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// log incoming request sizes for debugging
app.use((req, res, next) => {
  console.log("incoming", req.method, req.url, "content-length=", req.headers["content-length"]);
  next();
});

const FALLBACK_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_MODEL = process.env.GROQ_MODEL || FALLBACK_GROQ_MODEL;
const GROQ_KEY = process.env.GROQ_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Initialize ElevenLabs Client
const elevenLabsClient = ELEVENLABS_API_KEY ? new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }) : null;

console.log("Server config", {
  GROQ_MODEL,
  hasGroqKey: !!GROQ_KEY,
  hasElevenLabsKey: !!ELEVENLABS_API_KEY,
  hasElevenLabsVoiceId: !!ELEVENLABS_VOICE_ID,
  hasAgentId: !!getAgentId(),
  agentEnabled: isAgentEnabled(),
});

// Simple health
app.get("/", (req, res) => res.json({ ok: true }));

app.get("/config", (req, res) => {
  const agentEnabled = isAgentEnabled();
  res.json({
    groqModel: GROQ_MODEL,
    elevenLabsEnabled: isElevenLabsEnabled(),
    elevenLabsModel: getElevenLabsModel(),
    agentEnabled,
    agentId: agentEnabled ? getAgentId() : null,
    voiceMode: agentEnabled ? "agent" : isElevenLabsEnabled() ? "tts" : "browser",
  });
});

app.get("/agent-session", async (req, res) => {
  const agentId = getAgentId();
  if (!isAgentEnabled()) {
    return res.status(503).json({ error: "ElevenLabs agent is not configured." });
  }

  try {
    const response = await axios.get(
      "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
      {
        params: { agent_id: agentId },
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }
    );

    return res.json({ signedUrl: response.data.signed_url, agentId });
  } catch (err) {
    const status = err?.response?.status;
    const message = err?.response?.data?.detail?.message || err.message;
    const missingConvaiPermission =
      status === 401 && String(message).toLowerCase().includes("convai");

    if (missingConvaiPermission || status === 401) {
      return res.json({
        agentId,
        usePublicAgent: true,
        note: "Using public agent mode. Enable ConvAI permission on your API key for signed URLs.",
      });
    }

    console.error("/agent-session error", status, message);
    return res.status(status || 500).json({ error: message || "Failed to create agent session" });
  }
});

app.post("/voice", async (req, res) => {
  let text = trimMessage(req.body?.text, MAX_VOICE_TEXT_LENGTH);
  console.log("/voice request body", { length: text.length });
  if (!text) {
    console.error("/voice missing text");
    return res.status(400).json({ error: "missing text" });
  }

  if (!isElevenLabsEnabled()) {
    return res.status(503).json({
      error: "ElevenLabs is disabled. Set ELEVENLABS_ENABLED=true and API keys to enable.",
      skipElevenLabs: true,
    });
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error("/voice ElevenLabs not configured", {
      hasKey: !!ELEVENLABS_API_KEY,
      hasVoiceId: !!ELEVENLABS_VOICE_ID,
    });
    return res.status(500).json({ error: "ElevenLabs is not configured" });
  }

  try {
    const model = getElevenLabsModel();
    console.log("/voice calling ElevenLabs", { voiceId: ELEVENLABS_VOICE_ID, model });
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text,
        model_id: model,
        voice_settings: { stability: 0.65, similarity_boost: 0.75 },
      },
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
      }
    );

    console.log("/voice ElevenLabs response length", response.data?.byteLength);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(response.data);
  } catch (err) {
    const { status, error, skipElevenLabs } = parseElevenLabsError(err);
    console.error("/voice ElevenLabs error", status, error);
    res.status(status).json({ error, skipElevenLabs });
  }
});

app.post("/speech-to-speech", upload.single("audio"), async (req, res) => {
  console.log("/speech-to-speech request received", { fileSize: req.file?.size });

  if (!req.file) {
    console.error("/speech-to-speech missing audio file");
    return res.status(400).json({ error: "Missing audio file. Upload a WAV or MP3 file." });
  }

  if (!isElevenLabsEnabled()) {
    return res.status(503).json({
      error: "ElevenLabs is disabled. Set ELEVENLABS_ENABLED=true and API keys to enable.",
      skipElevenLabs: true,
    });
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error("/speech-to-speech ElevenLabs not configured");
    return res.status(500).json({ error: "ElevenLabs is not configured" });
  }

  if (!elevenLabsClient) {
    console.error("/speech-to-speech ElevenLabsClient not initialized");
    return res.status(500).json({ error: "ElevenLabs client initialization failed" });
  }

  try {
    const model = getElevenLabsModel();
    console.log("/speech-to-speech converting audio", {
      voiceId: ELEVENLABS_VOICE_ID,
      model,
      audioSize: req.file.size,
    });

    const audioStream = await elevenLabsClient.speechToSpeech.convert(ELEVENLABS_VOICE_ID, {
      audio: req.file.buffer,
      model_id: model,
      voice_settings: { stability: 0.65, similarity_boost: 0.75 },
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log("/speech-to-speech response generated", { outputSize: audioBuffer.byteLength });
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    const { status, error, skipElevenLabs } = parseElevenLabsError(err);
    console.error("/speech-to-speech ElevenLabs error", status, error);
    res.status(status).json({ error, skipElevenLabs });
  }
});

app.post("/chat", async (req, res) => {
  const rawMessage = req.body?.message;
  const message = trimMessage(rawMessage);
  console.log("/chat request body", { rawLength: String(rawMessage || "").length, length: message.length });

  if (!message) {
    console.error("/chat missing message");
    return res.status(400).json({ error: "missing message", reply: "Please enter a message." });
  }

  if (String(rawMessage || "").trim().length > MAX_MESSAGE_LENGTH) {
    console.warn("/chat message truncated", String(rawMessage).length);
  }

  if (!GROQ_KEY) {
    console.warn("/chat no GROQ key configured, echoing message instead");
    return res.json({ reply: `Echo: ${message}` });
  }

  try {
    const callGroq = (model) =>
      axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: VOICE_SYSTEM_PROMPT },
            { role: "user", content: message },
          ],
          max_tokens: MAX_REPLY_TOKENS,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

    console.log("/chat calling Groq", { model: GROQ_MODEL, message });
    let response;
    try {
      response = await callGroq(GROQ_MODEL);
    } catch (err) {
      const isTooLarge =
        err?.response?.status === 413 ||
        err?.response?.data?.error?.code === "request_too_large";
      if (isTooLarge && GROQ_MODEL !== FALLBACK_GROQ_MODEL) {
        console.warn("/chat model too large, retrying with", FALLBACK_GROQ_MODEL);
        response = await callGroq(FALLBACK_GROQ_MODEL);
      } else {
        throw err;
      }
    }

    console.log("/chat Groq response", response.data);
    const reply = response.data?.choices?.[0]?.message?.content || "(no reply)";
    res.json({ reply });
  } catch (err) {
    console.error("/chat Groq error", err?.response?.status, err?.response?.data || err.message || err);
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.error?.message;
    const reply =
      status === 413 || /entity too large/i.test(apiMessage || "")
        ? "Your question is too long. Please ask a shorter question."
        : apiMessage || "Error generating reply";
    res.status(status === 413 ? 413 : 500).json({ reply, error: reply });
  }
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request too large",
      reply: "Your message is too long. Please ask a shorter question.",
    });
  }
  next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
