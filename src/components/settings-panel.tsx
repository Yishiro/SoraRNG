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
    <section className="panel settings-list" aria-labelledby="settings-title">
      <h2 id="settings-title">Votre façon de voyager</h2>
      <PrivacySettings player={player} busy={busy} onSaved={() => onSaved()} />
      <div className="setting-row">
        <div>
          <h3>Réduire les animations</h3>
          <p>
            Passez directement aux cartes et retournez-les à votre rythme. Le
            réglage système de réduction du mouvement est aussi respecté.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={Boolean(player?.reducedMotion)}
            disabled={!player || busy}
            onChange={onToggleMotion}
          />
          <span aria-hidden="true" />
          <span className="sr-only">Réduire les animations</span>
        </label>
      </div>
      <div className="setting-row">
        <div>
          <h3>
            <VolumeX size={15} aria-hidden="true" /> Bruitages d’ouverture
          </h3>
          <p>
            Facultatifs et coupés par défaut. Activez-les avec le bouton de son
            pendant l’ouverture d’un booster.
          </p>
        </div>
      </div>
      {signedIn && (
        <div className="setting-row">
          <div>
            <h3>Compte Discord</h3>
            <p>Votre collection reste liée à votre compte Discord.</p>
          </div>
          <button className="outline" onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </div>
      )}
    </section>
  );
}
