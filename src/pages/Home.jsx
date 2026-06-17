import { useState } from "react";

export default function Home() {
  const [listening, setListening] = useState(false);

  const startVoice = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("SpeechRecognition not supported in this browser.");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      try {
        const res = await fetch("http://localhost:5000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const data = await res.json();
        const reply = data.reply || "";
        if (reply) {
          const speech = new SpeechSynthesisUtterance(reply);
          window.speechSynthesis.speak(speech);
        }
      } catch (err) {
        console.error(err);
      }
    };

    recognition.start();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center">
        <div className="mic-label" id="transcriptLabel">{listening ? "Listening..." : "Tap to speak"}</div>

        <div className="mic-wrapper">
          <button
            onClick={startVoice}
            aria-label="Start speaking"
            className={`btn-mic relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-transform ${
              listening ? "scale-95" : "hover:scale-[1.03]"
            }`}
          >
            <span className="sr-only">Start Voice</span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" fill="white" opacity="0.98"/>
              <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V22h2v-4.08A7 7 0 0 0 19 11z" fill="white" opacity="0.06"/>
            </svg>
          </button>

          <div className="mic-ring" aria-hidden>
            <div className={`ring ${listening ? '' : 'opacity-0'}`}></div>
            <div className={`ring ${listening ? '' : 'opacity-0'}`}></div>
            <div className={`ring ${listening ? '' : 'opacity-0'}`}></div>
          </div>
        </div>
      </div>
    </main>
  );
}