import { useEffect, useRef, useCallback } from 'react';
import { api } from './api';

type SSEHandler = (event: { type: string; data: any; timestamp: string }) => void;

export function useSSE(onEvent: SSEHandler, enabled = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(api.streamUrl);
    eventSourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        onEventRef.current(parsed);
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(() => {
        if (enabled) connect();
      }, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect, enabled]);
}
