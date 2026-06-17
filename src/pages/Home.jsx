import { useEffect, useRef, useState } from "react";

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
  const [userMessage, setUserMessage] = useState("");
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
  const hasConversation = Boolean(userMessage && auraReply);
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
    if (!reply || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(reply);
    speech.onstart = () => setPhase("speaking");
    speech.onend = () => setPhase("responded");
    window.speechSynthesis.speak(speech);
  };

  const sendMessage = async (message) => {
    if (!message) return;
    setUserMessage(message);
    setLiveTranscript("");
    setPhase("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const reply = data.reply || "No response from Nova.";
      setAuraReply(reply);
      setPhase("responded");
      speakReply(reply);
    } catch (err) {
      console.error(err);
      setPhase("idle");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLiveTranscript("");
    setPhase(hasConversation ? "responded" : "idle");
  };

  const startVoice = () => {
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
        sendMessage(finalText.trim());
      }
    };

    recognition.start();
  };

  const handleTextSubmit = async (event) => {
    event.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    await sendMessage(trimmed);
    setInputText("");
  };

  const statusText = {
    idle: "Tap the mic to speak",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    responded: "Tap the mic to speak",
  }[phase];

  return (
    <main className={`aura-screen ${hasConversation ? "aura-screen-chat" : ""}`}>
      <div className="aura-glow aura-glow-top" />
      <div className="aura-glow aura-glow-right" />

      <header className="aura-header">
        <div className="aura-logo">
          <span className="aura-logo-mark" />
          Nova
        </div>
      </header>

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

        {hasConversation && phase !== "listening" && (
          <div className="aura-conversation-card">
            <div className="aura-conversation-block">
              <span className="aura-conversation-label aura-conversation-label-you">You</span>
              <p className="aura-conversation-text">{userMessage}</p>
            </div>
            <div className="aura-conversation-block">
              <span className="aura-conversation-label aura-conversation-label-aura">Nova</span>
              <p className="aura-conversation-text">{auraReply}</p>
            </div>
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

      <div className="aura-footer">Nova · voice-first AI</div>
    </main>
  );
}
