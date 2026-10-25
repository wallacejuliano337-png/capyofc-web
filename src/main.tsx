import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ui";
import "./styles.css";

// Registro seguro do Service Worker (somente no navegador web/Safari/PWA, nunca dentro do Electron)
if (typeof window !== "undefined" && "serviceWorker" in navigator && !window.arena) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[CapyChat PWA] Nova versão disponível. Atualizando aplicação...");
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn("[CapyChat PWA] Service Worker não registrado:", err);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
