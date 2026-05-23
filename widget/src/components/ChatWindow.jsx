import React, { useRef, useEffect, useState } from "react";
import { useChat } from "../hooks/useChat.js";
import { MessageBubble } from "./MessageBubble.jsx";
import { TypingIndicator } from "./TypingIndicator.jsx";
import { QuickReplies } from "./QuickReplies.jsx";
import { VoiceInput } from "./VoiceInput.jsx";

const PROACTIVE_DELAY_MS = 15_000;

export function ChatWindow() {
  const { messages, isLoading, emailSent, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const proactiveTimer = useRef(null);

  // Proactive open after 15 s if user hasn't opened yet
  useEffect(() => {
    proactiveTimer.current = setTimeout(() => {
      setIsOpen((v) => {
        if (!v) setShowBadge(true);
        return v;
      });
    }, PROACTIVE_DELAY_MS);
    return () => clearTimeout(proactiveTimer.current);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setShowBadge(false);
      clearTimeout(proactiveTimer.current);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text) => {
    setInput(text);
    setTimeout(() => sendMessage(text), 50);
  };

  const showQuickReplies = messages.length === 0 && !isLoading;

  return (
    <>
      {/* Floating button */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998 }}>
        {showBadge && !isOpen && (
          <div style={styles.badge}>1</div>
        )}
        <button
          style={{ ...styles.fab, ...(isOpen ? styles.fabOpen : {}) }}
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Open HiDow chat"
        >
          {isOpen ? "✕" : "💬"}
        </button>
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <div style={styles.headerTitle}>HiDow Assistant</div>
              <div style={styles.headerSub}>TENS/EMS Expert · Sales Support</div>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.welcome}>
                👋 Hi! Ask me anything about HiDow devices, or I can help you place an order.
                <br /><br />
                🇪🇸 También hablo español.
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} streaming={m.streaming} products={m.products} />
            ))}

            {isLoading && <TypingIndicator />}

            {emailSent && (
              <div style={styles.emailNote}>
                ✅ Order confirmation email sent!
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {showQuickReplies && (
            <QuickReplies onSelect={(t) => { sendMessage(t); }} />
          )}

          {/* Input */}
          <div style={styles.inputArea}>
            <textarea
              ref={inputRef}
              rows={1}
              style={styles.input}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading} />
            <button
              style={{ ...styles.sendBtn, opacity: isLoading || !input.trim() ? 0.5 : 1 }}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#1a1a2e",
    color: "white",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    transition: "transform .2s",
    display: "block",
  },
  fabOpen: {
    fontSize: 20,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#ef4444",
    color: "white",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  panel: {
    position: "fixed",
    bottom: 92,
    right: 24,
    width: 360,
    height: 540,
    background: "white",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,.18)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: "#1a1a2e",
    color: "white",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: { fontSize: 15, fontWeight: 600 },
  headerSub: { fontSize: 11, opacity: 0.7, marginTop: 1 },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  welcome: {
    background: "#f0f2f5",
    borderRadius: "12px 12px 12px 4px",
    padding: "12px 14px",
    fontSize: 14,
    color: "#1a1a2e",
    lineHeight: 1.5,
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  emailNote: {
    alignSelf: "center",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    padding: "5px 12px",
    borderRadius: 20,
  },
  inputArea: {
    display: "flex",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid #eee",
  },
  input: {
    flex: 1,
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
  },
  sendBtn: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 16,
    cursor: "pointer",
    transition: "opacity .15s",
    flexShrink: 0,
  },
};
