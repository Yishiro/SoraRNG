import { signOut } from 'next-auth/react';
import { VolumeX } from 'lucide-react';
import type { Player } from '../game/core';
import PrivacySettings from './privacy-settings';

export default function SettingsPanel({
  player,
  busy,
  signedIn,
  onSaved,
  onToggleMotion,
}: {
  player?: Player;
  busy: boolean;
  signedIn: boolean;
  onSaved: () => Promise<void>;
  onToggleMotion: () => void;
}) {
  return (
    <section className="panel">
      <h2>Votre façon de voyager</h2>
      <PrivacySettings player={player} busy={busy} onSaved={() => onSaved()} />
      <div className="mission-row">
        <VolumeX />
        <div>
          <h3>Animation et confort visuel</h3>
          <p>
            Passez directement aux cartes et retournez-les à votre rythme. Le
            réglage système de réduction du mouvement est aussi respecté.
          </p>
        </div>
        <button
          className="outline"
          disabled={!player || busy}
          onClick={onToggleMotion}
        >
          {player?.reducedMotion
            ? 'Animations réduites'
            : 'Réduire les animations'}
        </button>
      </div>
      <p>
        Les bruitages d’ouverture sont facultatifs et coupés par défaut.
        Activez-les avec le bouton de son dans l’ouverture d’un booster.
      </p>
      {signedIn && (
        <button className="outline" onClick={() => void signOut()}>
          Se déconnecter
        </button>
      )}
    </section>
  );
}
