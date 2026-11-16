import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppDataProvider } from './hooks/useAppData.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { registerSW } from './lib/messaging.js';
import './styles.css';

// En production, le service worker met l'application en cache : elle s'ouvre même sans réseau.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => registerSW().catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppDataProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppDataProvider>
    </BrowserRouter>
  </StrictMode>,
);
