# Product Requirements Document (PRD)

Project: AI Voice Assistant PWA
Owner: (Your Name)
Date: 2026-06-19

## 1. Purpose
Provide a concise Product Requirements Document for stakeholders (recruiters, clients) describing the AI Voice Assistant PWA: a real-time conversational voice app using ElevenLabs Conversational AI (primary) and GROQ (secondary fallback). This doc clarifies goals, scope, success metrics, user journeys, functional and non-functional requirements, and demo acceptance criteria.

## 2. Objectives & Success Metrics
- Objective 1: Demonstrate real-time speech-to-speech conversation with a natural-sounding voice.
  - Metric: Voice response plays within 2 seconds of request 90% of the time.
- Objective 2: Provide a reliable fallback to a text-based LLM when voice agent is unavailable.
  - Metric: Fallback engages automatically on auth/payment errors and returns a reply within 3 seconds.
- Objective 3: Deliver a production-ready demo for recruiting clients to evaluate technical competency.
  - Metric: Clean README and README + live demo link, video clip, and working code in GitHub repository.

## 3. Target Users
- Recruiters assessing full-stack and AI integration skills.
- Product managers and clients evaluating feasibility for voice assistants.
- Potential employers or freelance clients who want a demo-ready voice solution.

## 4. Key User Stories
- As a user, I can press a microphone button, speak, and hear a voice response from the AI.
- As a user, if the ElevenLabs agent is not available, I still get a text reply (via GROQ) and TTS output.
- As a recruiter, I can run the demo locally or visit the deployed site and see logs and error handling.

## 5. Scope (In-Scope)
- Real-time speech capture from the browser microphone.
- Conversational session with ElevenLabs Conversational AI (agent) using signed session or agent ID.
- Text-to-speech (TTS) audio playback for responses.
- GROQ chat completions as fallback for text replies.
- Console logging and clear error messages for demonstration.

## 6. Out of Scope (for demo)
- User authentication and multi-user account management.
- Persistent server-side conversation storage (beyond browser localStorage).
- Production telemetry (Sentry) or paid analytics integration—can be added later.

## 7. Functional Requirements
FR-1: Microphone access request and permission handling in the browser.
FR-2: Start and stop conversation sessions with ElevenLabs agent via `/api/agent-session`.
FR-3: Send audio (or speech transcripts) to the agent; receive assistant messages and play back audio.
FR-4: If ElevenLabs agent returns 401/402 or a signed URL is unavailable, call `/api/chat` to get GROQ reply.
FR-5: Expose `/api/config` to the frontend to decide voice mode: `agent`, `tts`, or `browser`.
FR-6: Provide clear console logs for each stage (agent session, chat call, voice TTS call, errors).
FR-7: Support environment configuration through `server/.env` and `server/.env.example`.

## 8. Non-functional Requirements
NFR-1: Response latency for TTS audio must be low (<2s typical) depending on upstream model.
NFR-2: App must be installable as a PWA and be responsive across device sizes.
NFR-3: Safe handling of API keys — do not commit secrets to Git.
NFR-4: Robust error handling — map ElevenLabs HTTP codes to friendly messages and fallbacks.

## 9. Data & Privacy
- Microphone audio is streamed to ElevenLabs and/or GROQ for processing. Document this in demos and disclose data flow to stakeholders.
- No user PII is stored on the demo (only local conversation history in browser localStorage).

## 10. API Contracts
- GET `/api/config` → returns { agentEnabled, agentId, elevenLabsEnabled, elevenLabsModel, groqModel, voiceMode }
- GET `/api/agent-session` → returns { signedUrl, agentId } or a public fallback note
- POST `/api/chat` → body { message } → returns { reply }
- POST `/api/voice` → body { text } → returns audio/mpeg stream

## 11. Environment Variables (for deployment)
- `GROQ_API_KEY` (required if using GROQ)
- `GROQ_MODEL` (optional, fallback available)
- `ELEVENLABS_API_KEY` (required)
- `ELEVENLABS_AGENT_ID` (for conversational agent)
- `ELEVENLABS_VOICE_ID` (for TTS fallback)
- `ELEVENLABS_ENABLED`, `ELEVENLABS_AGENT_ENABLED`, `ELEVENLABS_MODEL`, `PORT`

## 12. Acceptance Criteria / Demo Checklist
- [ ] Microphone request prompt appears and grants access.
- [ ] Pressing mic and speaking results in an audible response from AI.
- [ ] Console shows `🎙️ [AGENT SESSION]` flow and `✅ [VOICE]` success messages.
- [ ] If ElevenLabs returns 401/402, console shows error and app falls back to GROQ.
- [ ] README.md and PRD.md are present in the repo and link to a live demo or video.

## 13. Risks & Mitigations
- Risk: ElevenLabs API key lacks required ConvAI/TTS permissions → Mitigation: show instructions to enable permissions and test with known free voice IDs.
- Risk: Voice ID requires paid plan (402) → Mitigation: switch to free voice IDs and document tradeoffs in README/PRD.
- Risk: Browser compatibility with microphone APIs → Mitigation: recommend Chrome or recent browsers and PWA install instructions.

## 14. Timeline (Minimal for demo)
- Day 0: Repo and README updated, `server/.env.example` prepared (done).
- Day 1: Finalize PRD and create demo video (30s sample interaction).
- Day 2: Polish UI, add deploy link, finalize portfolio entry.

## 15. Next Steps
1. Commit and push `PRD.md` to GitHub.
2. Record a 30-second demo video showing live S2S conversation and upload with the README.
3. Share GitHub + demo link on LinkedIn and recruiter messages.

---

*Prepared for demo and recruiting use. For changes or additional deliverables (SLA, pricing, hosting), I can extend this PRD.*
