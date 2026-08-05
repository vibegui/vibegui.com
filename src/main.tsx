/**
 * Application Entry Point
 *
 * Mounts the React app and initializes global styles.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles/main.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
// Bust poisoned browser caches of prior hashed bundles (HTML served as JS).
root.dataset.build = "20260805-asset-mime";

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
