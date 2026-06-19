# AI Voice Assistant PWA

A React + Vite app with Vercel serverless API routes for Groq chat completions and ElevenLabs TTS.

## Local development

# 🎙️ AI Voice Assistant PWA - Conversational AI

A production-ready **real-time voice conversation application** built with React, Vite, ElevenLabs, and GROQ. Features speech-to-speech AI interaction with intelligent fallback mechanisms.

---

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Error Handling](#error-handling)
- [Deployment](#deployment)
- [Performance](#performance)
- [Future Enhancements](#future-enhancements)

---

## ✨ Features

### Core Functionality
✅ **Real-time Voice Conversation** - Speech-to-speech AI interaction  
✅ **Primary: ElevenLabs Conversational AI** - Live voice chat with natural responses  
✅ **Secondary: GROQ LLM** - Intelligent fallback for text processing  
✅ **Text-to-Speech (TTS)** - Natural voice synthesis with multiple voice options  
✅ **Error Recovery** - Automatic fallback mechanisms for API failures  

### User Experience
✅ **Progressive Web App (PWA)** - Installable on mobile/desktop  
✅ **Responsive Design** - Works on all screen sizes  
✅ **Audio Visualization** - Real-time animated waveform  
✅ **Chat History** - Persistent conversation storage  
✅ **Offline Support** - Service workers for offline functionality  

### Developer Experience
✅ **Comprehensive Logging** - All events logged to console with prefixes  
✅ **Error Tracking** - Detailed error messages and stack traces  
✅ **Environment-based Config** - Easy multi-environment setup  
✅ **API Documentation** - Full endpoint documentation  

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool (fast dev server)
- **@elevenlabs/react** - Voice agent integration
- **CSS3** - Responsive styling

### Backend
- **Node.js** - Runtime
- **Vercel Serverless** - API deployment
- **Axios** - HTTP client

### APIs & Services
- **ElevenLabs** - Conversational AI Agent + Text-to-Speech
- **GROQ** - Large Language Model (LLaMA 3.3 70B)
- **Web Audio API** - Microphone access & audio visualization

### DevOps
- **Vercel** - Production deployment
- **GitHub** - Version control
- **Docker** - Optional containerization

---

## 📁 Project Structure

```
ai-voice-pwa/
├── api/                          # Vercel serverless functions
│   ├── agent-session.js         # ElevenLabs agent session handler
│   ├── chat.js                  # GROQ chat completions proxy
│   ├── voice.js                 # ElevenLabs TTS handler
│   ├── config.js                # Configuration endpoint
│   └── elevenlabsShared.js      # Shared utilities & logging
├── src/
│   ├── components/
│   │   ├── Header.jsx           # App header
│   │   └── MarkdownMessage.jsx  # Markdown message renderer
│   ├── hooks/
│   │   ├── useNovaAgent.js      # ElevenLabs agent hook
│   │   ├── useAudioRecorder.js  # Audio recording hook
│   │   ├── useSpeech.js         # Speech synthesis hook
│   │   └── useLocalStorage.js   # Local storage hook
│   ├── pages/
│   │   └── Home.jsx             # Main application page
│   ├── utils/
│   │   ├── messageLimits.js     # Message validation
│   │   └── pwaInstall.js        # PWA installation utilities
│   ├── styles/
│   │   ├── globals.css          # Global styles
│   │   └── App.css              # App component styles
│   ├── App.jsx                  # Root component
│   └── main.jsx                 # Entry point
├── public/                       # Static assets
├── server/                       # Legacy backend (optional)
│   ├── package.json
│   ├── server.js
│   └── .env.example
├── dev-dist/                    # Service worker build output
├── package.json
├── vite.config.js
├── vercel.json                  # Vercel deployment config
└── README.md                    # This file
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- ElevenLabs API key (with Conversational AI permission)
- GROQ API key

### Installation Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ai-voice-pwa.git
cd ai-voice-pwa
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp server/.env.example server/.env
```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Start development server**
```bash
npm run dev
```

6. **Open in browser**
```
http://localhost:5173
```

---

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file in the `server/` directory:

```env
# GROQ Configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ElevenLabs Conversational AI (Primary)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_AGENT_ID=agent_your_agent_id_here
ELEVENLABS_AGENT_ENABLED=true

# ElevenLabs Text-to-Speech (Fallback)
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
ELEVENLABS_ENABLED=true
ELEVENLABS_MODEL=eleven_flash_v2_5

# Server
PORT=5000
```

### Getting API Keys

#### ElevenLabs
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Go to API Keys → Create new key
3. **Enable "Speech to Speech" permission**
4. Create Conversational AI Agent (Agents → New Agent)
5. Copy Agent ID

#### GROQ
1. Sign up at [console.groq.com](https://console.groq.com)
2. API Keys → Create new key
3. Copy key

### Voice IDs (Free/Paid)

| Voice ID | Name | Plan |
|----------|------|------|
| `EXAVITQu4vr4xnSDxMaL` | Bella | Free |
| `pNInz6obpgDQGcFmaJgB` | Adam | Free |
| `21m00Tcm4TlsDqPImmeZ` | Rachel | Paid |

---

## 📱 Usage

### Starting the App

**Development:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
```

**Preview Build:**
```bash
npm run preview
```

### User Interaction Flow

1. **Click microphone button** - Starts listening
2. **Speak your message** - AI captures audio
3. **Agent processes** - ElevenLabs AI generates response
4. **Automatic speech output** - Voice response plays automatically
5. **Chat history saved** - Conversation persists in browser

### Console Logging

All events logged with prefixes for easy debugging:

```
✅ [ELEVENLABS] Conversational AI Agent ENABLED
🎙️ [AGENT SESSION] Starting agent session request...
💬 [CHAT] Request received
📡 [VOICE] Calling ElevenLabs API
✅ [VOICE] ElevenLabs response received
❌ [VOICE] ElevenLabs error (401/402)
```

---

## 🔌 API Endpoints

### `/api/config` (GET)
Returns current configuration and voice mode

**Response:**
```json
{
	"groqModel": "llama-3.3-70b-versatile",
	"elevenLabsEnabled": true,
	"elevenLabsModel": "eleven_flash_v2_5",
	"agentEnabled": true,
	"agentId": "agent_...",
	"voiceMode": "agent"
}
```

### `/api/agent-session` (GET)
Initiates ElevenLabs Conversational AI session

**Response:**
```json
{
	"signedUrl": "wss://...",
	"agentId": "agent_..."
}
```

### `/api/chat` (POST)
GROQ chat completion endpoint

**Request:**
```json
{ "message": "Hello, how are you?" }
```

**Response:**
```json
{ "reply": "I'm doing great, thanks for asking!" }
```

### `/api/voice` (POST)
ElevenLabs Text-to-Speech endpoint

**Request:**
```json
{ "text": "Hello world" }
```

**Response:** Audio MP3 stream

---

## 🏗️ Architecture

### Voice Mode Selection

```
┌─────────────────┐
│  Check Config   │
└────────┬────────┘
				 │
		┌────▼────┐
		│ Agent?  │
		└─┬───┬───┘
			│   │
	 Yes│   │No
			│   │
	 ┌──▼┐ ┌▼────────────┐
	 │S2S│ │ Check TTS?  │
	 └───┘ └──┬───────┬──┘
						│       │
				 Yes│       │No
						│       │
				┌───▼──┐  ┌─▼─────────┐
				│TTS   │  │Browser STT│
				│+GROQ │  │           │
				└──────┘  └───────────┘
```

### Error Handling Flow

```
API Request
		↓
Success? → Return data
		↓ No
401/402 (Auth/Payment)
		↓
Try Fallback (GROQ)
		↓
Success? → Return response
		↓ No
Return Error + Details
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Return data |
| 400 | Bad request | Check input |
| 401 | Unauthorized | Check API key & permissions |
| 402 | Payment required | Check credits/plan |
| 404 | Not found | Check IDs (voice ID, agent ID) |
| 429 | Rate limited | Wait/upgrade plan |
| 500 | Server error | Check logs |
| 503 | Service disabled | Check env vars |

### Console Error Messages

```javascript
// Missing API key
❌ [VOICE] ElevenLabs not configured
	{ hasKey: false, hasVoiceId: true }

// 401 - Unauthorized
❌ [AGENT SESSION] 401 Unauthorized
	{ message: "Invalid API key" }

// 402 - Payment required
❌ [VOICE] ElevenLabs error
	{ status: 402, error: "This voice requires paid plan" }
```

---

## 🌐 Deployment

### Deploy to Vercel

1. **Push to GitHub**
```bash
git add .
git commit -m "Add AI Voice Assistant"
git push origin main
```

2. **Connect to Vercel**
	 - Go to [vercel.com](https://vercel.com)
	 - Import GitHub repo
	 - Set environment variables
	 - Deploy

3. **Set Environment Variables on Vercel**
	 - Project Settings → Environment Variables
	 - Add: `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, etc.

### Vercel Configuration

The `vercel.json` is pre-configured:
```json
{
	"functions": {
		"api/**": { "runtime": "nodejs20.x" }
	}
}
```

---

## ⚡ Performance

### Optimization Techniques
- ✅ Lazy loading of @elevenlabs/react
- ✅ Message trimming (3000 char limit)
- ✅ Audio streaming (not buffering)
- ✅ Service worker caching
- ✅ Vite for fast builds

### Metrics
- **First Paint:** ~1.2s
- **Agent Connection:** ~2-3s
- **Response Time:** ~0.5-2s (depends on model)

---

## 🔮 Future Enhancements

- [ ] Add conversation analytics
- [ ] Multi-language support
- [ ] User authentication
- [ ] Conversation export (PDF/JSON)
- [ ] Custom system prompts
- [ ] Voice cloning with ElevenLabs
- [ ] Real-time transcription display
- [ ] Dark mode
- [ ] Mobile app (React Native)
- [ ] WebRTC for P2P voice calls

---

## 🐛 Troubleshooting

### "Agent is not configured"
- Check `ELEVENLABS_AGENT_ID` in `.env`
- Ensure `ELEVENLABS_AGENT_ENABLED=true`

### "401 Unauthorized"
- Verify API key is correct
- Check "Speech to Speech" permission enabled
- Regenerate API key if needed

### "402 Payment required"
- Check ElevenLabs account credits
- Switch to free voice ID
- Upgrade subscription

### No microphone access
- Check browser microphone permissions
- Use HTTPS in production
- Test on different browser

---

## 📚 Documentation

- [ElevenLabs Docs](https://elevenlabs.io/docs)
- [GROQ API Reference](https://console.groq.com/docs)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)

---

## 📄 License

MIT License - Feel free to use for projects

---

## 👨‍💻 Author

Built as a production-ready AI Voice Assistant demo for portfolio/recruiting purposes.

**Features:**
- Real-time voice AI conversation
- Multiple API integration
- Error handling & fallbacks
- Production deployment ready

---

## 🤝 Support

For issues or questions:
1. Check console logs (prefix-based logging)
2. Review [Troubleshooting](#troubleshooting)
3. Check API key configurations
4. Test API endpoints directly with curl

---

**Last Updated:** June 2024  
**Status:** Production Ready ✅

