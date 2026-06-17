import { useEffect, useState } from "react";

export default function Home() {
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [inputText, setInputText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Tap the mic to speak");

  useEffect(() => {
    const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechSupported(supported);
  }, []);

  const speakReply = (reply) => {
    if (!reply) return;
    const speech = new SpeechSynthesisUtterance(reply);
    window.speechSynthesis.speak(speech);
  };

  const sendMessage = async (message) => {
    if (!message) return;
    try {
      setStatusMessage("Thinking...");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const reply = data.reply || "No response from Aura.";
      setStatusMessage("Tap the mic to speak");
      speakReply(reply);
    } catch (err) {
      console.error(err);
      setStatusMessage("Something went wrong. Try again.");
    }
  };

  const startVoice = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage("Speech not supported. Use text input instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setStatusMessage("Listening...");
    };
    recognition.onend = () => {
      setListening(false);
      setStatusMessage("Tap the mic to speak");
    };
    recognition.onerror = () => {
      setListening(false);
      setStatusMessage("Speech recognition failed. Try text input.");
    };

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      await sendMessage(text);
    };

    recognition.start();
  };

  const handleTextSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <main className="aura-screen">
      <div className="aura-glow aura-glow-top" />
      <div className="aura-glow aura-glow-right" />

      <header className="aura-header">
        <div className="aura-logo">
          <span className="aura-logo-mark" />
          Aura
        </div>
      </header>

      <div className="aura-body">
        <span className="aura-state-label aura-state-label-active">{statusMessage}</span>

        <div className="aura-visualizer-shell">
          <div className="aura-visualizer-glass">
            <div className="aura-visualizer-bars">
              {Array.from({ length: 13 }).map((_, index) => (
                <span
                  key={index}
                  className={`aura-bar ${listening ? "aura-bar-active" : ""}`}
                  style={{ height: `${7 + index * 3.5}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          className={`aura-mic-button ${listening ? "aura-mic-active" : ""}`}
          onClick={startVoice}
          type="button"
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
          {speechSupported ? (listening ? "Listening" : "Tap to ask Aura") : "Use text input"}
        </button>

        {!speechSupported && (
          <form className="aura-text-form" onSubmit={handleTextSubmit}>
            <input
              className="aura-text-input"
              type="text"
              placeholder="Type your question for Aura"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button className="aura-text-submit" type="submit">
              Send
            </button>
          </form>
        )}

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
      </div>

      <div className="aura-footer">Aura · voice-first AI</div>
    </main>
  );
}
