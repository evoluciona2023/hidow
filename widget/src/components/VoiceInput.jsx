import React, { useState, useRef, useCallback } from "react";

const SupportedAPI = typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export function VoiceInput({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const start = useCallback(() => {
    if (!SupportedAPI || listening) return;

    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  if (!SupportedAPI) return null;

  return (
    <button
      onClick={listening ? stop : start}
      disabled={disabled}
      title={listening ? "Stop recording" : "Voice input"}
      style={{
        background: listening ? "#ef4444" : "#e5e7eb",
        color: listening ? "white" : "#374151",
        border: "none",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s",
        flexShrink: 0,
      }}
    >
      {listening ? "⏹" : "🎤"}
    </button>
  );
}
