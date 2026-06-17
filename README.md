# AI Voice Assistant PWA

A React + Vite app with Vercel serverless API routes for Groq chat completions and ElevenLabs TTS.

## Local development

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

Use Vercel serverless APIs in production. For local server testing, the legacy backend is in `server/`.

## Deployment

This project is configured for Vercel with:
- `vercel.json` for API functions
- `/api/chat.js` for Groq proxying
- `/api/voice.js` for ElevenLabs TTS

## Environment variables

Set these in Vercel or a local `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=groq/compound
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
```

