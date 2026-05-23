import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ProductCards } from "./ProductCard.jsx";

export function MessageBubble({ role, content, streaming, products, index, onFeedback }) {
  const isUser = role === "user";
  const [rated, setRated] = useState(null);

  const handleRate = (rating) => {
    if (rated) return;
    setRated(rating);
    onFeedback?.(index, rating);
  };

  return (
    <div style={{ ...styles.wrap, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "82%", gap: 6 }}>
        <div style={isUser ? styles.user : styles.assistant}>
          {isUser ? (
            content
          ) : (
            <>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 6px" }}>{children}</p>,
                  strong: ({ children }) => <strong>{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: "4px 0" }}>{children}</ul>,
                  li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                }}
              >
                {content}
              </ReactMarkdown>
              {streaming && <span style={styles.cursor}>▌</span>}
            </>
          )}
        </div>

        {/* Product cards below assistant messages */}
        {!isUser && !streaming && products?.length > 0 && (
          <ProductCards products={products} />
        )}

        {/* Thumbs up/down — only for completed assistant messages */}
        {!isUser && !streaming && content && (
          <div style={styles.feedbackRow}>
            <button
              style={{ ...styles.feedBtn, ...(rated === "up" ? styles.feedActive : {}) }}
              onClick={() => handleRate("up")}
              title="Helpful"
              aria-label="Mark as helpful"
            >
              👍
            </button>
            <button
              style={{ ...styles.feedBtn, ...(rated === "down" ? styles.feedActiveDown : {}) }}
              onClick={() => handleRate("down")}
              title="Not helpful"
              aria-label="Mark as not helpful"
            >
              👎
            </button>
            {rated && (
              <span style={styles.feedThanks}>{rated === "up" ? "Thanks!" : "Got it"}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", width: "100%" },
  user: {
    background: "#2563eb",
    color: "white",
    padding: "10px 14px",
    borderRadius: "12px 12px 4px 12px",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  assistant: {
    background: "#f0f2f5",
    color: "#1a1a2e",
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 4px",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  cursor: {
    display: "inline-block",
    animation: "blink 1s step-end infinite",
    fontSize: 14,
    color: "#2563eb",
  },
  feedbackRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
  },
  feedBtn: {
    background: "none",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "2px 7px",
    fontSize: 13,
    cursor: "pointer",
    color: "#888",
    transition: "all .15s",
  },
  feedActive: {
    background: "#dcfce7",
    borderColor: "#86efac",
    color: "#16a34a",
  },
  feedActiveDown: {
    background: "#fee2e2",
    borderColor: "#fca5a5",
    color: "#dc2626",
  },
  feedThanks: {
    fontSize: 11,
    color: "#888",
    marginLeft: 2,
  },
};
