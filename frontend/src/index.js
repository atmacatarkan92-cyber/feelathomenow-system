import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
setInterval(() => {
  const badge = document.getElementById("emergent-badge");
  if (badge) {
    badge.remove();
  }
}, 500);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
