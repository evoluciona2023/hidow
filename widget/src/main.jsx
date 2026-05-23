import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Mount in an isolated shadow root to avoid CSS conflicts with the host page
const host = document.createElement("div");
host.id = "hidow-widget-root";
document.body.appendChild(host);

const root = createRoot(host);
root.render(<App />);
