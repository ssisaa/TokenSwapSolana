// Import polyfills first
import "./lib/polyfill";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <App />
);
