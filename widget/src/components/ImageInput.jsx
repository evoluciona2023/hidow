import React, { useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageInput({ onRecommendation, sessionId, disabled }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await toBase64(file);
      const base64 = dataUrl.split(",")[1];
      const res = await fetch(API_BASE + "/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { recommendation } = await res.json();
      if (recommendation) onRecommendation(recommendation);
    } catch (e) {
      onRecommendation("Sorry, I couldn't analyze that image. Please try again or describe your pain area in text.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <button
        style={{
          ...styles.btn,
          opacity: disabled || loading ? 0.5 : 1,
          cursor: disabled || loading ? "default" : "pointer",
        }}
        onClick={() => !disabled && !loading && fileRef.current?.click()}
        title={loading ? "Analyzing..." : "Upload photo for product recommendation"}
        aria-label="Upload photo"
      >
        {loading ? "⏳" : "📷"}
      </button>
    </>
  );
}

const styles = {
  btn: {
    background: "#f0f2f5",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
    transition: "opacity .15s",
  },
};
