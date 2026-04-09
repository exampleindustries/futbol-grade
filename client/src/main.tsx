import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// GitHub Pages SPA redirect: restore the path from 404.html
try {
  const sp = new URLSearchParams(window.location.search);
  const redirect = sp.get('p');
  if (redirect) {
    window.history.replaceState(null, '', redirect);
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(<App />);
