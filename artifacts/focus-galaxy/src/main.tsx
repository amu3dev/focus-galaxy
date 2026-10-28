import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if (
  typeof window !== 'undefined' &&
  (import.meta.env.PROD || (window as Window & { __ENABLE_SW__?: boolean }).__ENABLE_SW__) &&
  'serviceWorker' in navigator &&
  window.isSecureContext
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Offline shell caching is a progressive enhancement; never block the app.
    });
  });
}
