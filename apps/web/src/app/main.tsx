import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { initTelegramSdk } from "../shared/lib/index.js";
import { App } from "./App.js";

initTelegramSdk();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
