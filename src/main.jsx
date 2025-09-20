import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./components/App/App.jsx";
import "./styles/variables.css";
import "./styles/base.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      const url =
        r.active?.scriptURL ||
        r.installing?.scriptURL ||
        r.waiting?.scriptURL ||
        "";
      if (/\/cnm-sw\.js(\?|$)/.test(url)) {
        r.unregister();
      }
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
