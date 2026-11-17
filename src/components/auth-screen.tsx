'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Crown, Shield } from 'lucide-react';
import { authMessage } from '../game/auth-messages';
export default function AuthScreen({ error }: { error?: string }) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((p) => setAvailable(Boolean(p.discord)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <main style={{ maxWidth: 650, padding: '70px 22px' }}>
      <section className="panel">
        <Crown color="#e6bc68" size={36} />
        <h1>Retrouver votre royaume</h1>
        <p>
          Connectez-vous avec Discord pour retrouver votre collection et vos
          ressources. Aucun serveur Discord particulier n’est requis.
        </p>
        {error && (
          <p role="alert" className="notice">
            {authMessage(error)}
          </p>
        )}
        {!loading && !available && (
          <p role="status">
            Connexion Discord indisponible : les identifiants OAuth et le secret
            de session doivent être configurés côté serveur.
          </p>
        )}
        <button
          className="primary"
          disabled={loading || !available}
          onClick={() => void signIn('discord', { callbackUrl: '/dashboard' })}
        >
          <Shield size={17} />
          {loading ? 'Vérification…' : 'Se connecter avec Discord'}
        </button>
        <p>
          <Link className="text-link" href="/dashboard">
            ← Retour au sanctuaire
          </Link>
        </p>
      </section>
    </main>
  );
}
