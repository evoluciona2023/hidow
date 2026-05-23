import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const STREAM_URL = API_BASE + "/api/chat/stream";
const SESSION_KEY = "hidow_session_id";

function getOrCreateSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function messagesKey(sid) { return `hidow_messages_${sid}`; }

function loadSavedMessages(sid) {
  try {
    const raw = localStorage.getItem(messagesKey(sid));
    if (!raw) return [];
    return JSON.parse(raw).map(m => ({ ...m, streaming: false }));
  } catch { return []; }
}

function saveMessages(sid, msgs) {
  try {
    const stable = msgs.filter(m => !m.streaming);
    if (!stable.length) return;
    localStorage.setItem(messagesKey(sid), JSON.stringify(stable));
  } catch { /* ignore */ }
}

export function useChat() {
  const sessionId = useRef(getOrCreateSessionId());
  const [messages, setMessages] = useState(() => loadSavedMessages(sessionId.current));
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [lastOrderRef, setLastOrderRef] = useState(null);
  const abortRef = useRef(null);

  // Persist messages whenever they change
  useEffect(() => {
    saveMessages(sessionId.current, messages);
  }, [messages]);

  const sendMessage = useCallback(async (userText) => {
    if (!userText?.trim() || isLoading) return;

    const userMsg = { role: "user", content: userText };
    const history = [...messages, userMsg];

    setMessages([...history, { role: "assistant", content: "", streaming: true, products: [] }]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, sessionId: sessionId.current }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[CLOSE]") break;
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === "text") {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) updated[updated.length - 1] = { ...last, content: last.content + chunk.content };
                return updated;
              });
            }
            if (chunk.type === "done") {
              if (chunk.emailSent) setEmailSent(true);
              if (chunk.orderRef) setLastOrderRef(chunk.orderRef);
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) updated[updated.length - 1] = { ...last, streaming: false, products: chunk.products || [] };
                return updated;
              });
            }
            if (chunk.type === "error") {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: chunk.content, streaming: false, products: [] };
                return updated;
              });
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting. Please try again or call **(314) 569-2888**.",
          streaming: false,
          products: [],
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const submitFeedback = useCallback(async (messageIndex, rating) => {
    try {
      await fetch(API_BASE + "/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, messageIndex, rating }),
      });
    } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setEmailSent(false);
    setLastOrderRef(null);
    const newId = crypto.randomUUID();
    sessionId.current = newId;
    try { localStorage.setItem(SESSION_KEY, newId); } catch { /* ignore */ }
  }, []);

  return {
    messages,
    isLoading,
    emailSent,
    lastOrderRef,
    sendMessage,
    submitFeedback,
    reset,
    sessionId: sessionId.current,
  };
}
