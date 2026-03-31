import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { inject } from '@vercel/analytics';
import App from './App';
import './index.css';

const shouldInjectAnalytics =
  import.meta.env.PROD ||
  import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';

const globalWithAnalyticsFlag = globalThis as typeof globalThis & {
  __vercelAnalyticsInjected?: boolean;
};

if (shouldInjectAnalytics && !globalWithAnalyticsFlag.__vercelAnalyticsInjected) {
  inject();
  globalWithAnalyticsFlag.__vercelAnalyticsInjected = true;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);