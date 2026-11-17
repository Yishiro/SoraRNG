'use client';
import { useEffect } from 'react';

// The Auth.js session endpoint renews both the encrypted JWT and its persistent
// HttpOnly cookie. Reading getServerSession from an App Router route does not.
export default function SessionKeeper() {
  useEffect(() => {
    let busy = false;
    let last = 0;
    const controller = new AbortController();
    async function renew() {
      if (document.hidden || busy || Date.now() - last < 5 * 60 * 1000) return;
      busy = true;
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) last = Date.now();
      } catch {
        /* Retry on the next focus or hourly renewal. */
      } finally {
        busy = false;
      }
    }
    void renew();
    const timer = setInterval(() => void renew(), 60 * 60 * 1000);
    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', renew);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', renew);
    };
  }, []);
  return null;
}
