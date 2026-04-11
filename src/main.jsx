import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log("DIAGNOSTIC: main.jsx loaded");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("DIAGNOSTIC ERROR: #root element not found!");
  } else {
    console.log("DIAGNOSTIC: #root element found, mounting React...");
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log("DIAGNOSTIC: Render call completed.");
  }
} catch (err) {
  console.error("DIAGNOSTIC CRASH in main.jsx:", err);
}
