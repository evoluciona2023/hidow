import React from "react";
import ReactMarkdown from "react-markdown";
import { ProductCards } from "./ProductCard.jsx";

export function MessageBubble({ role, content, streaming, products }) {
  const isUser = role === "user";
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

        {/* Product cards below the message */}
        {!isUser && !streaming && products?.length > 0 && (
          <ProductCards products={products} />
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
};
