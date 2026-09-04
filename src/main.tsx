import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { crashlytics } from "./lib/crashlytics";

// Global Crashlytics Error Trapping
const isBenignError = (msg: string): boolean => {
  const lowercase = (msg || '').toLowerCase();
  return (
    lowercase.includes('websocket closed without opened') ||
    lowercase.includes('web socket closed without opened') ||
    lowercase.includes('closed without opening') ||
    lowercase.includes('socket closed') ||
    lowercase.includes('failed to connect to websocket') ||
    lowercase.includes('hmr') ||
    lowercase.includes('hot module replacement') ||
    lowercase.includes('pending promise was never set') ||
    lowercase.includes('internal assertion failed') ||
    lowercase.includes('cross-origin-opener-policy') ||
    lowercase.includes('window.closed') ||
    lowercase.includes('m.stop is not a function') ||
    lowercase.includes('.stop is not a function') ||
    lowercase.includes('stop is not a function') ||
    lowercase.includes('ws_abort') ||
    lowercase.includes('joining channel failed, rollback')
  );
};

window.onerror = (message, source, lineno, colno, error) => {
  const msgStr = [
    error?.message,
    error?.stack,
    message?.toString(),
    typeof error === 'object' ? JSON.stringify(error) : ''
  ].filter(Boolean).join(' ');

  if (isBenignError(msgStr)) {
    console.log("[Crashlytics] Suppressed transient error log:", msgStr);
    return true;
  }
  crashlytics().recordError(error || message?.toString() || 'Unknown error', 'critical').catch(console.error);
};

window.onunhandledrejection = (event) => {
  const reason = event.reason;
  const reasonStr = [
    reason?.message,
    reason?.stack,
    reason?.name,
    String(reason || ''),
    typeof reason === 'object' ? JSON.stringify(reason) : ''
  ].filter(Boolean).join(' ');

  if (isBenignError(reasonStr)) {
    console.log("[Crashlytics] Suppressed unhandled rejection log:", reasonStr);
    event.preventDefault();
    return;
  }
  crashlytics().recordError(`Unhandled Promise Rejection: ${reason?.message || reason}`, 'high').catch(console.error);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
