import React from "react";

export function TypingIndicator() {
  return (
    <div style={styles.wrap}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }} />
      ))}
      <style>{`
        @keyframes hdBounce {
          0%,60%,100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    gap: 4,
    padding: "10px 14px",
    background: "#f0f2f5",
    borderRadius: "12px 12px 12px 4px",
    alignSelf: "flex-start",
    width: 52,
  },
  dot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#888",
    animation: "hdBounce 1.2s infinite",
  },
};
