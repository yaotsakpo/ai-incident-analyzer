import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { inject } from '@vercel/analytics';
import App from './App';
import './index.css';

declare global {
  // eslint-disable-next-line no-var
  var __vercelAnalyticsInjected: boolean | undefined;
}

const shouldInjectAnalytics =
  import.meta.env.PROD ||
  import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';

if (shouldInjectAnalytics && !globalThis.__vercelAnalyticsInjected) {
  inject();
  globalThis.__vercelAnalyticsInjected = true;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);