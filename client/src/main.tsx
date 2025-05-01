// Import polyfills first
import "./lib/polyfill";

import { createRoot } from "react-dom/client";
import App from "./App";

// Wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Other styles
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <App />
);
