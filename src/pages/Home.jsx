import { useEffect, useRef, useState } from "react";
import MarkdownMessage, { buildSpeechText } from "../components/MarkdownMessage";
import useLocalStorage from "../hooks/useLocalStorage";
import { trimMessage } from "../utils/messageLimits";

const BAR_COUNT = 17;
const BAR_HEIGHTS = [12, 22, 34, 44, 38, 28, 18, 14, 20, 32, 42, 36, 26, 16, 12, 24, 40];
const IDLE_BAR_HEIGHTS = [...BAR_HEIGHTS];

const detectSpeechSupport = () =>
  typeof window !== "undefined" &&
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function Home() {
  const [phase, setPhase] = useState("idle");
  const [speechSupported] = useState(detectSpeechSupport);
  const [showTextForm, setShowTextForm] = useState(() => !detectSpeechSupport());
  const [inputText, setInputText] = useState("");
  const [conversation, setConversation] = useLocalStorage("nova-chat-history", []);
  const [auraReply, setAuraReply] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [barLevels, setBarLevels] = useState(IDLE_BAR_HEIGHTS);
  const recognitionRef = useRef(null);
  const processingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);

  const isActive = phase === "listening" || phase === "thinking" || phase === "speaking";
  const hasConversation = conversation.length > 0;
  const isVoiceReactive = phase === "listening";

  const stopAudioVisualizer = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setBarLevels(IDLE_BAR_HEIGHTS);
  };

  useEffect(() => {
    if (phase !== "listening") return undefined;

    let cancelled = false;

    const startVisualizer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          if (cancelled || !analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          const nextLevels = Array.from({ length: BAR_COUNT }, (_, index) => {
            const bin = Math.floor((index / BAR_COUNT) * dataArray.length);
            const nextBin = Math.min(bin + 1, dataArray.length - 1);
            const value = (dataArray[bin] + dataArray[nextBin]) / 2 / 255;
            const minHeight = 10;
            const maxHeight = 52;
            return minHeight + value ** 0.85 * (maxHeight - minHeight);
          });

          setBarLevels(nextLevels);
          rafRef.current = requestAnimationFrame(updateBars);
        };

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        rafRef.current = requestAnimationFrame(updateBars);
      } catch (err) {
        console.error(err);
      }
    };

    startVisualizer();

    return () => {
      cancelled = true;
      stopAudioVisualizer();
    };
  }, [phase]);

  const speakReply = (reply) => {
    const speechText = buildSpeechText(reply);
    if (!speechText || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(speechText);
    speech.onstart = () => setPhase("speaking");
    speech.onend = () => setPhase("responded");
    window.speechSynthesis.speak(speech);
  };

  const sendMessage = async (message) => {
    const safeMessage = trimMessage(message);
    if (!safeMessage) return;

    setConversation((prev) => [...prev, { role: "user", text: safeMessage }]);
    setLiveTranscript("");
    window.speechSynthesis?.cancel();
    setPhase("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: safeMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorReply =
          data.reply ||
          data.error ||
          (res.status === 413
            ? "Your question is too long. Please ask a shorter question."
            : "Something went wrong. Try again.");
        setAuraReply(errorReply);
        setConversation((prev) => [...prev, { role: "assistant", text: errorReply }]);
        setPhase("responded");
        return;
      }
      const reply = data.reply || "No response from Nova.";
      setAuraReply(reply);
      setConversation((prev) => [...prev, { role: "assistant", text: reply }]);
      setPhase("responded");
      speakReply(reply);
    } catch (err) {
      console.error(err);
      const errorReply = "Something went wrong. Try again.";
      setAuraReply(errorReply);
      setConversation((prev) => [...prev, { role: "assistant", text: errorReply }]);
      setPhase("responded");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLiveTranscript("");
    setPhase(hasConversation ? "responded" : "idle");
  };

  const startVoice = () => {
    window.speechSynthesis?.cancel();

    if (phase === "listening") {
      stopListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowTextForm(true);
      setPhase("listening");
      setTimeout(() => setPhase("idle"), 650);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setPhase("listening");
      setLiveTranscript("");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (processingRef.current) {
        processingRef.current = false;
        return;
      }
      setPhase((current) => (current === "listening" ? "idle" : current));
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setShowTextForm(true);
      setPhase("idle");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += chunk;
        } else {
          interim += chunk;
        }
      }
      setLiveTranscript(finalText || interim);
      if (finalText) {
        processingRef.current = true;
        recognition.stop();
        sendMessage(trimMessage(finalText));
      }
    };

    recognition.start();
  };

  const handleTextSubmit = async (event) => {
    event.preventDefault();
    const trimmed = trimMessage(inputText);
    if (!trimmed) return;
    await sendMessage(trimmed);
    setInputText("");
  };

  const clearConversation = () => {
    setConversation([]);
    setAuraReply("");
    setPhase("idle");
    setLiveTranscript("");
  };

  const latestReply = auraReply || conversation.slice().reverse().find((item) => item.role === "assistant")?.text || "";

  const copyReply = async () => {
    if (!latestReply) return;
    try {
      await navigator.clipboard.writeText(latestReply);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const statusText = {
    idle: "Tap the mic to speak",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    responded: "Tap the mic to speak",
  }[phase];

  return (
    <main className="aura-screen">
      <div className="aura-glow aura-glow-top" />
      <div className="aura-glow aura-glow-right" />

      {/* Professional Header */}
      <header className="aura-app-header">
        <div className="aura-header-content">
          <div className="aura-logo-section">
            <div className="aura-logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff3b30" />
                    <stop offset="50%" stopColor="#ff2a68" />
                    <stop offset="100%" stopColor="#ff9b00" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="10" fill="url(#logoGradient)" />
                <path d="M16 8v12M12 14h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="aura-logo-text">
              <h1 className="aura-app-title">Nova</h1>
              <p className="aura-app-subtitle">AI Voice Assistant</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 50/50 Layout */}
      <div className="aura-main-content">
        {/* Left Panel - Chat History */}
        <div className="aura-chat-panel">
          <div className="aura-chat-header">
            <h2 className="aura-chat-title">Conversation</h2>
            {hasConversation && (
              <button
                className="aura-chat-clear-btn"
                type="button"
                onClick={() => {
                  clearConversation();
                }}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                ✕
              </button>
            )}
          </div>
          <div className="aura-chat-messages">
            {conversation.length === 0 ? (
              <div className="aura-chat-empty">
                <div className="aura-empty-icon">💬</div>
                <p>No messages yet. Start by tapping the mic!</p>
              </div>
            ) : (
              conversation.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}-${entry.text.slice(0, 20)}`}
                  className={`aura-message-item aura-message-${entry.role}`}
                >
                  <div className="aura-message-label">
                    {entry.role === "user" ? "👤 You" : "🤖 Nova"}
                  </div>
                  {entry.role === "assistant" ? (
                    <MarkdownMessage content={entry.text} />
                  ) : (
                    <p className="aura-message-text">{entry.text}</p>
                  )}
                </div>
              ))
            )}
          </div>
          {hasConversation && latestReply && (
            <div className="aura-chat-footer">
              <button
                className="aura-copy-reply-btn"
                type="button"
                onClick={copyReply}
                title="Copy last reply"
              >
                📋 Copy Reply
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Assistant/Mic Controls */}
        <div className="aura-assistant-panel">
          <div className="aura-body">
          <span
            className={`aura-state-label ${
              phase === "idle" || phase === "responded" ? "aura-state-label-muted" : "aura-state-label-active"
            }`}
          >
            {statusText}
          </span>

        <div className={`aura-visualizer-shell ${isActive ? "aura-visualizer-live" : ""}`}>
          <div className="aura-visualizer-rings" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="aura-visualizer-glass">
            <div className="aura-visualizer-bars">
              {barLevels.map((height, index) => (
                <span
                  key={index}
                  className={`aura-bar ${isActive ? "aura-bar-active" : ""} ${
                    isVoiceReactive ? "aura-bar-voice" : ""
                  }`}
                  style={{
                    height: `${height}px`,
                    animationDelay: isVoiceReactive ? undefined : `${index * 0.07}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {phase === "listening" ? (
          <button className="aura-stop-button" onClick={stopListening} type="button">
            <span className="aura-stop-icon" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            className={`aura-mic-button ${isActive ? "aura-mic-active" : ""}`}
            onClick={startVoice}
            type="button"
            disabled={phase === "thinking" || phase === "speaking"}
          >
            <span className="aura-mic-ring" aria-hidden="true" />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="aura-mic-icon"
              aria-hidden="true"
            >
              <path d="M12 19v3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <rect x="9" y="2" width="6" height="13" rx="3" />
            </svg>
            {showTextForm || !speechSupported ? "Type to ask Nova" : "Tap to ask Nova"}
          </button>
        )}

        {phase === "listening" && (
          <div className="aura-transcript-strip">
            <span className="aura-transcript-label">You</span>
            <p className="aura-transcript-text">
              {liveTranscript || "Start speaking..."}
            </p>
          </div>
        )}

        {phase === "idle" && !hasConversation && (
          <div className="aura-hint-card">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="aura-hint-icon"
              aria-hidden="true"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
              <path d="M4 17v2" />
              <path d="M5 18H3" />
            </svg>
            Ask anything — calendar, drafts, reminders, ideas.
          </div>
        )}

        {(showTextForm || !speechSupported) && phase === "idle" && (
          <div className="aura-text-card">
            <div className="aura-text-card-label">Text input mode</div>
            <form className="aura-text-form" onSubmit={handleTextSubmit}>
              <input
                className="aura-text-input"
                type="text"
                placeholder="Type your question for Nova"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button className="aura-text-submit" type="submit">
                Send
              </button>
            </form>
          </div>
        )}
        </div>
      </div>
      </div>

      {/* <div className="aura-footer">Nova · voice-first AI</div> */}
    </main>
  );
}
