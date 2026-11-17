'use client';
import { useEffect, useState } from 'react';
type LocalAsset = { image: string; thumbnail: string };
let pending: Promise<Record<string, LocalAsset>> | undefined;
export function useLocalCardAsset(id: string) {
  const [asset, setAsset] = useState<LocalAsset | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let active = true;
    pending ??= fetch('/api/local-card-assets', { cache: 'no-store' })
      .then(async (r) => (r.ok ? await r.json() : {}))
      .catch(() => ({}));
    void pending.then((index) => {
      if (active) setAsset(index[id] ?? null);
    });
    return () => {
      active = false;
    };
  }, [id]);
  return asset;
}
