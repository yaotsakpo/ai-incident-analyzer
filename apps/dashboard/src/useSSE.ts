import { useEffect, useRef } from 'react';
import { api } from './api';

type SSEEvent = { type: string; data: any; timestamp: string };
type SSEHandler = (event: SSEEvent) => void;

// ---------------------------------------------------------------------------
// Shared singleton EventSource so multiple components reuse one connection.
// ---------------------------------------------------------------------------

let sharedES: EventSource | null = null;
let subscriberCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<SSEHandler>();

function ensureConnection() {
  if (sharedES && sharedES.readyState !== EventSource.CLOSED) return;

  sharedES = new EventSource(api.streamUrl);

  sharedES.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data);
      listeners.forEach(fn => fn(parsed));
    } catch {}
  };

  sharedES.onerror = () => {
    sharedES?.close();
    sharedES = null;
    // Reconnect after 3 s if there are still subscribers
    if (subscriberCount > 0 && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (subscriberCount > 0) ensureConnection();
      }, 3000);
    }
  };
}

function subscribe(handler: SSEHandler) {
  listeners.add(handler);
  subscriberCount++;
  ensureConnection();
}

function unsubscribe(handler: SSEHandler) {
  listeners.delete(handler);
  subscriberCount--;
  if (subscriberCount <= 0) {
    subscriberCount = 0;
    sharedES?.close();
    sharedES = null;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }
}

// ---------------------------------------------------------------------------
// Hook — drop-in replacement, same signature as before.
// ---------------------------------------------------------------------------

export function useSSE(onEvent: SSEHandler, enabled = true) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const handler: SSEHandler = (evt) => onEventRef.current(evt);
    subscribe(handler);
    return () => unsubscribe(handler);
  }, [enabled]);
}
