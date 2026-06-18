import { useEffect, useRef, useState } from "react";
import MarkdownMessage, { buildSpeechText } from "../components/MarkdownMessage";
import useLocalStorage from "../hooks/useLocalStorage";
import useNovaAgent from "../hooks/useNovaAgent";
import useAudioRecorder from "../hooks/useAudioRecorder";
import { trimMessage } from "../utils/messageLimits";
import { getInstallInstructions, isStandaloneApp } from "../utils/pwaInstall";

const BAR_COUNT = 17;
const BAR_HEIGHTS = [12, 22, 34, 44, 38, 28, 18, 14, 20, 32, 42, 36, 26, 16, 12, 24, 40];
const IDLE_BAR_HEIGHTS = [...BAR_HEIGHTS];
const ELEVENLABS_SKIP_KEY = "nova-skip-elevenlabs";

const readElevenLabsPreference = () => {
  if (typeof sessionStorage === "undefined") return true;
  return sessionStorage.getItem(ELEVENLABS_SKIP_KEY) !== "1";
};

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
  const [showChatPanel, setShowChatPanel] = useState(false); // Mobile tab state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installStatus, setInstallStatus] = useState(() =>
    isStandaloneApp() ? "installed" : null
  );
  const [installInstructions] = useState(() => getInstallInstructions());
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine
  );
  const [useElevenLabs, setUseElevenLabs] = useState(readElevenLabsPreference);
  const [voiceMode, setVoiceMode] = useState(() => {
    // voiceMode: "tts" (text-to-speech), "s2s" (speech-to-speech), or "browser" (speechSynthesis)
    if (typeof sessionStorage === "undefined") return "tts";
    return sessionStorage.getItem("nova-voice-mode") || "tts";
  });
  const recognitionRef = useRef(null);
  const processingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);
  const { isRecording: isRecordingS2S, startRecording, stopRecording, cancelRecording } = useAudioRecorder();

  const hasConversation = conversation.length > 0;

  const {
    agentEnabled,
    agentConnected,
    agentConnecting,
    toggleAgentSession,
    stopAgentSession,
    sendAgentText,
    updateAgentBars,
    resetAgentConversation,
  } = useNovaAgent({
    setConversation,
    setAuraReply,
    setLiveTranscript,
    setPhase,
  });
  const isActive =
    phase === "listening" ||
    phase === "thinking" ||
    phase === "speaking" ||
    agentConnected ||
    agentConnecting;
  const isChatPanelVisible = hasConversation && showChatPanel;
  const isVoiceReactive = phase === "listening" || (agentConnected && !agentConnecting);

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
    if (!isActive && !agentConnected) return undefined;

    let cancelled = false;

    if (agentConnected) {
      const animateAgentBars = () => {
        if (cancelled) return;
        updateAgentBars(setBarLevels, IDLE_BAR_HEIGHTS);
        rafRef.current = requestAnimationFrame(animateAgentBars);
      };
      rafRef.current = requestAnimationFrame(animateAgentBars);
      return () => {
        cancelled = true;
        stopAudioVisualizer();
      };
    }

    if (phase !== "listening") return undefined;

    // Web Speech API already owns the mic on mobile Chrome — a second getUserMedia()
    // stream triggers: "Speech Recognition ... cannot record now as Chrome is recording".
    if (speechSupported) {
      const start = performance.now();

      const animateBars = (now) => {
        if (cancelled) return;

        const elapsed = (now - start) / 1000;
        setBarLevels(
          Array.from({ length: BAR_COUNT }, (_, index) => {
            const wave =
              Math.sin(elapsed * 3.8 + index * 0.5) * 0.6 +
              Math.sin(elapsed * 7 + index * 0.3) * 0.4;
            const normalized = (wave + 1) / 2;
            return 10 + normalized ** 0.85 * 42;
          })
        );
        rafRef.current = requestAnimationFrame(animateBars);
      };

      rafRef.current = requestAnimationFrame(animateBars);

      return () => {
        cancelled = true;
        stopAudioVisualizer();
      };
    }

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
        console.error("Microphone access error:", err);
        if (err.name === "NotAllowedError") {
          console.warn("Microphone permission denied by user");
        } else if (err.name === "NotFoundError") {
          console.warn("No microphone device found");
        } else if (err.name === "NotReadableError") {
          console.warn("Microphone is being used by another application");
        }
      }
    };

    startVisualizer();

    return () => {
      cancelled = true;
      stopAudioVisualizer();
    };
  }, [phase, speechSupported, agentConnected, isActive, updateAgentBars]);

  const disableElevenLabs = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(ELEVENLABS_SKIP_KEY, "1");
    }
    setUseElevenLabs(false);
  };

  const handleVoiceModeChange = (newMode) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("nova-voice-mode", newMode);
    }
    console.log("🎤 Voice Mode Changed:", newMode);
    setVoiceMode(newMode);
  };

  const convertSpeechToSpeech = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      console.log("Sending audio to S2S endpoint", { size: audioBlob.size });
      const res = await fetch("/api/speech-to-speech", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.skipElevenLabs) {
          handleVoiceModeChange("browser");
        }
        console.error("S2S conversion failed", data);
        return null;
      }

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("S2S conversion error:", err);
      return null;
    }
  };

  const speakWithBrowser = (speechText) => {
    if (!window.speechSynthesis) {
      setPhase("responded");
      return;
    }

    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(speechText);
    speech.onstart = () => setPhase("speaking");
    speech.onend = () => setPhase("responded");
    window.speechSynthesis.speak(speech);
  };

  useEffect(() => {
    if (!useElevenLabs) return undefined;

    let cancelled = false;
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.elevenLabsEnabled === false) {
          disableElevenLabs();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [useElevenLabs]);

  const speakReply = async (reply) => {
    const speechText = buildSpeechText(reply);
    if (!speechText) return;
    console.log("🔊 Speaking reply via", useElevenLabs ? "ElevenLabs" : "Browser", { voiceMode });

    setPhase("speaking");

    if (!useElevenLabs) {
      speakWithBrowser(speechText);
      return;
    }

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.skipElevenLabs) {
          disableElevenLabs();
        }
        speakWithBrowser(speechText);
        return;
      }

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPhase("responded");
        URL.revokeObjectURL(url);
      };

      try {
        await audio.play();
      } catch {
        URL.revokeObjectURL(url);
        speakWithBrowser(speechText);
      }
    } catch {
      speakWithBrowser(speechText);
    }
  };

  const sendMessage = async (message) => {
    const safeMessage = trimMessage(message);
    if (!safeMessage) return;
    console.log("💬 Sending message to Groq:", safeMessage);

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

  const startVoice = async () => {
    window.speechSynthesis?.cancel();
    console.log("🎙️ startVoice called", { voiceMode, agentEnabled, phase });

    if (agentEnabled) {
      try {
        await toggleAgentSession();
      } catch (err) {
        alert(err.message || "Could not start Nova voice agent. Check microphone permission and agent settings.");
      }
      return;
    }

    // Handle Speech-to-Speech mode
    if (voiceMode === "s2s") {
      console.log("🔄 S2S Mode Active", { isRecordingS2S });
      if (isRecordingS2S) {
        // Stop recording and convert
        try {
          setPhase("thinking");
          const audioBlob = await stopRecording();
          console.log("Audio recorded, converting via S2S", { size: audioBlob.size });

          const audioUrl = await convertSpeechToSpeech(audioBlob);
          if (audioUrl) {
            setPhase("speaking");
            const audio = new Audio(audioUrl);
            audio.onended = () => {
              setPhase("responded");
              URL.revokeObjectURL(audioUrl);
            };
            await audio.play();
          } else {
            setPhase("responded");
            alert("Failed to convert speech. Please try again.");
          }
        } catch (err) {
          console.error("S2S error:", err);
          setPhase("responded");
          alert("Error: " + (err.message || "Failed to process audio"));
        }
      } else {
        // Start recording
        try {
          await startRecording();
          setPhase("listening");
        } catch (err) {
          console.error("Recording error:", err);
          alert("Could not access microphone: " + err.message);
        }
      }
      return;
    }

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

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      recognitionRef.current = null;
      setShowTextForm(true);
      setPhase("idle");
      
      // Show user-friendly error messages
      if (event.error === "no-speech") {
        alert("No speech detected. Please try again and speak clearly.");
      } else if (event.error === "network") {
        alert("Network error. Please check your internet connection.");
      } else if (event.error === "permission-denied") {
        alert("Microphone permission denied. Please enable microphone access for this app.");
      } else if (event.error === "not-allowed") {
        alert("Speech Recognition not allowed. Please grant microphone permission.");
      } else {
        alert(`Speech error: ${event.error}. Please try again.`);
      }
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

    if (agentEnabled) {
      if (!agentConnected) {
        try {
          await toggleAgentSession();
        } catch (err) {
          alert(err.message || "Could not connect to Nova agent.");
          return;
        }
      }
      sendAgentText(trimmed);
      setInputText("");
      return;
    }

    await sendMessage(trimmed);
    setInputText("");
  };

  const latestReply = auraReply || conversation.slice().reverse().find((item) => item.role === "assistant")?.text || "";

  const clearConversation = () => {
    resetAgentConversation();
    setConversation([]);
    setAuraReply("");
    setPhase("idle");
    setLiveTranscript("");
    setShowChatPanel(false);
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstallStatus("installed");
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const openInstallPrompt = () => {
    if (installStatus === "installed") return;
    setShowInstallPrompt(true);
  };

  const handleInstallClick = async () => {
    if (installStatus === "installed") return;

    if (!deferredPrompt) {
      openInstallPrompt();
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallStatus("installed");
    }
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  const closeInstallPrompt = () => {
    setShowInstallPrompt(false);
  };

  const isInstalled = installStatus === "installed";
  const hasNativeInstall = Boolean(deferredPrompt);
  const canShowInstallUi = !isInstalled;

  const copyReply = async () => {
    if (!latestReply) return;
    try {
      await navigator.clipboard.writeText(latestReply);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const statusText = agentConnected
    ? {
        listening: "Nova is listening...",
        speaking: "Nova is speaking...",
        thinking: "Connecting to Nova...",
        responded: "Live conversation ended",
        idle: "Live with Nova",
      }[phase] || "Live with Nova"
    : {
        idle: agentEnabled ? "Tap to start live conversation" : "Tap the mic to speak",
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
              <p className="aura-app-subtitle">
                {agentEnabled ? "ElevenLabs Conversational Agent" : "AI Voice Assistant"}
              </p>
            </div>
          </div>
            {/* Mobile chat toggle (visible on small screens) */}
            <div className="aura-header-actions">
              {canShowInstallUi && (
                <button className="aura-install-header-btn" type="button" onClick={handleInstallClick}>
                  Install Nova
                </button>
              )}
              {!isOnline && (
                <span className="aura-offline-badge" title="You are offline">
                  Offline
                </span>
              )}
              <button
                className="aura-chat-toggle-btn"
                type="button"
                onClick={() => setShowChatPanel((s) => !s)}
                aria-label="Toggle chat panel"
                title="Toggle chat"
              >
                💬
              </button>
            </div>
        </div>
      </header>

      {showInstallPrompt && canShowInstallUi && (
        <div className="aura-install-overlay" role="dialog" aria-modal="true">
          <div className="aura-install-card">
            <div className="aura-install-card-top">
              <div>
                <p className="aura-install-pretitle">Progressive Web App</p>
                <h2 className="aura-install-title">
                  {hasNativeInstall ? "Install Nova on your device" : installInstructions.title}
                </h2>
              </div>
              <button className="aura-install-close" type="button" onClick={closeInstallPrompt} aria-label="Close install prompt">
                ×
              </button>
            </div>
            {hasNativeInstall ? (
              <>
                <p className="aura-install-copy">
                  Add Nova to your home screen for one-tap access. The app shell works offline; voice features need an internet connection.
                </p>
                <div className="aura-install-actions">
                  <button className="aura-install-button" type="button" onClick={handleInstallClick}>
                    Install Nova
                  </button>
                  <button className="aura-install-secondary" type="button" onClick={closeInstallPrompt}>
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="aura-install-copy">
                  Your browser has not shown the native install prompt yet. Follow these steps:
                </p>
                <ol className="aura-install-steps">
                  {installInstructions.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="aura-install-actions">
                  <button className="aura-install-secondary" type="button" onClick={closeInstallPrompt}>
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content - 50/50 Layout (Desktop) / Tabs (Mobile) */}
      <div className="aura-main-content">
        {/* Mobile Tabs */}
        {hasConversation && (
          <div className="aura-mobile-tabs">
            <button
              className={`aura-tab ${!isChatPanelVisible ? "aura-tab-active" : ""}`}
              onClick={() => setShowChatPanel(false)}
              type="button"
            >
              🎤 Mic
            </button>
            <button
              className={`aura-tab ${isChatPanelVisible ? "aura-tab-active" : ""}`}
              onClick={() => setShowChatPanel(true)}
              type="button"
            >
              💬 Chat ({conversation.length})
            </button>
          </div>
        )}

        {/* Left Panel - Chat History (Desktop always rendered) */}
        <div className="aura-chat-panel aura-chat-desktop">
          <div className="aura-chat-header">
            <h2 className="aura-chat-title">Conversation</h2>
            {hasConversation && (
              <div className="aura-chat-header-actions">
                <button
                  className="aura-chat-clear-btn"
                  type="button"
                  onClick={clearConversation}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  🗑️
                </button>
              </div>
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
            {hasConversation && auraReply && (
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

        {/* Mobile Chat Panel (only show when sidebar is NOT open) */}
        {isChatPanelVisible && (
          <div className="aura-chat-panel aura-chat-mobile">
            <div className="aura-chat-header">
              <h2 className="aura-chat-title">Conversation</h2>
              <div className="aura-chat-header-actions">
                <button
                  className="aura-chat-clear-btn"
                  type="button"
                  onClick={clearConversation}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="aura-chat-messages">
              {conversation.length === 0 ? (
                <div className="aura-chat-empty">
                  <div className="aura-empty-icon">💬</div>
                  <p>No messages yet</p>
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
            {hasConversation && auraReply && (
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
        )}

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

          {/* Voice Mode Selector */}
          {useElevenLabs && !agentEnabled && (
            <div className="aura-voice-mode-selector">
              <button
                className={`aura-voice-mode-btn ${voiceMode === "tts" ? "aura-voice-mode-active" : ""}`}
                type="button"
                onClick={() => handleVoiceModeChange("tts")}
                title="Text-to-Speech mode"
              >
                TTS
              </button>
              <button
                className={`aura-voice-mode-btn ${voiceMode === "s2s" ? "aura-voice-mode-active" : ""}`}
                type="button"
                onClick={() => handleVoiceModeChange("s2s")}
                title="Speech-to-Speech mode"
              >
                S2S
              </button>
              <button
                className={`aura-voice-mode-btn ${voiceMode === "browser" ? "aura-voice-mode-active" : ""}`}
                type="button"
                onClick={() => handleVoiceModeChange("browser")}
                title="Browser voice mode"
              >
                Browser
              </button>
            </div>
          )}

        <div className={`aura-visualizer-shell ${isActive || isRecordingS2S ? "aura-visualizer-live" : ""}`}>
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

        {agentConnected || phase === "listening" || isRecordingS2S ? (
          <button
            className="aura-stop-button"
            onClick={isRecordingS2S ? startVoice : (agentEnabled ? stopAgentSession : stopListening)}
            type="button"
          >
            <span className="aura-stop-icon" aria-hidden="true" />
            {agentEnabled && (agentConnected || phase === "listening") ? "End" : "Stop"}
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
            {agentEnabled
              ? "Start live chat"
              : showTextForm || !speechSupported
                ? "Type to ask Nova"
                : "Tap to ask Nova"}
          </button>
        )}

        {(phase === "listening" || (agentConnected && liveTranscript)) && (
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
