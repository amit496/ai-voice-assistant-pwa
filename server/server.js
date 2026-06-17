import 'dotenv/config';
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
// allow larger JSON bodies (adjust if you expect bigger payloads)
app.use(express.json({ limit: '256kb' }));

// log incoming request sizes for debugging
app.use((req, res, next) => {
  try {
    console.log('incoming', req.method, req.url, 'content-length=', req.headers['content-length']);
  } catch (e) {}
  next();
});

const GROQ_MODEL = process.env.GROQ_MODEL || "groq/compound";
const GROQ_KEY = process.env.GROQ_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

console.log("Server config", {
  GROQ_MODEL,
  hasGroqKey: !!GROQ_KEY,
  hasElevenLabsKey: !!ELEVENLABS_API_KEY,
  hasElevenLabsVoiceId: !!ELEVENLABS_VOICE_ID,
});

// Simple health
app.get("/", (req, res) => res.json({ ok: true }));

app.get("/config", (req, res) => {
  res.json({
    groqModel: GROQ_MODEL,
    elevenLabsEnabled: Boolean(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID),
  });
});

app.post("/voice", async (req, res) => {
  console.log("/voice request body", { length: (req.body?.text || '').length });
  let text = req.body?.text;
  if (!text) {
    console.error("/voice missing text");
    return res.status(400).json({ error: "missing text" });
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error("/voice ElevenLabs not configured", {
      hasKey: !!ELEVENLABS_API_KEY,
      hasVoiceId: !!ELEVENLABS_VOICE_ID,
    });
    return res.status(500).json({ error: "ElevenLabs is not configured" });
  }

  try {
    console.log("/voice calling ElevenLabs", { voiceId: ELEVENLABS_VOICE_ID });
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text,
        model: "eleven_monolingual_v1",
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
    console.error("/voice ElevenLabs error", err?.response?.status, err?.response?.data || err.message || err);
    res.status(500).json({ error: err?.response?.data?.error?.message || "ElevenLabs request failed" });
  }
});

app.post("/chat", async (req, res) => {
  console.log("/chat request body", { length: (req.body?.message || '').length });
  let message = req.body?.message;
  if (!message) {
    console.error("/chat missing message");
    return res.status(400).json({ error: "missing message" });
  }

  // Protect against overly large messages causing 413 errors or external API rejections
  const MAX_MESSAGE_LENGTH = 5000; // characters - adjust as needed
  if (message.length > MAX_MESSAGE_LENGTH) {
    console.warn('/chat message too large, truncating', message.length);
    message = message.slice(0, MAX_MESSAGE_LENGTH);
  }

  if (!GROQ_KEY) {
    console.warn("/chat no GROQ key configured, echoing message instead");
    return res.json({ reply: `Echo: ${message}` });
  }

  try {
    console.log("/chat calling Groq", { model: GROQ_MODEL, message });
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL,
        messages: [{ role: "user", content: message }],
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("/chat Groq response", response.data);
    const reply = response.data?.choices?.[0]?.message?.content || "(no reply)";
    res.json({ reply });
  } catch (err) {
    console.error("/chat Groq error", err?.response?.status, err?.response?.data || err.message || err);
    const reply = err?.response?.data?.error?.message || "Error generating reply";
    res.status(500).json({ reply });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
