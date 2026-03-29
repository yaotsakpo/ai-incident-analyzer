import { useState, useEffect } from 'react';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function useTimeAgo(dates: string[], intervalMs = 15000): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    dates.forEach(d => m.set(d, formatTimeAgo(d)));
    return m;
  });

  useEffect(() => {
    const update = () => {
      const m = new Map<string, string>();
      dates.forEach(d => m.set(d, formatTimeAgo(d)));
      setMap(m);
    };
    update();
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [dates.join(','), intervalMs]);

  return map;
}

export { formatTimeAgo };
