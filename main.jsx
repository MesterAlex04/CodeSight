import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App.jsx";
import "./src/index.css";

function ensureRoot() {
  const id = "root";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

const rootEl = ensureRoot();
const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);