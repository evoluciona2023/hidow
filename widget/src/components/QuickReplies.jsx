import React from "react";

const SUGGESTIONS_EN = [
  "What is TENS/EMS?",
  "Show wireless devices",
  "I have back pain — recommendations?",
  "Prices & products",
];

const SUGGESTIONS_ES = [
  "¿Qué es TENS/EMS?",
  "Ver dispositivos inalámbricos",
  "Tengo dolor de espalda",
  "Precios y productos",
];

export function QuickReplies({ onSelect, lang = "en" }) {
  const suggestions = lang === "es" ? SUGGESTIONS_ES : SUGGESTIONS_EN;
  return (
    <div style={styles.wrap}>
      {suggestions.map((s) => (
        <button key={s} style={styles.btn} onClick={() => onSelect(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: "0 16px 12px",
  },
  btn: {
    background: "white",
    border: "1px solid #2563eb",
    color: "#2563eb",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
  },
};
