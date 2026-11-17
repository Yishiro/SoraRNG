const messages: Record<string, string> = {
  AccessDenied:
    'La connexion a été refusée. Aucune session de jeu n’a été ouverte.',
  OAuthCallback:
    'Le retour de Discord n’a pas pu être validé. Le lien peut avoir expiré ; recommencez la connexion.',
  OAuthSignin:
    'La connexion à Discord n’a pas pu démarrer. Réessayez dans quelques instants.',
  OAuthAccountNotLinked:
    'Ce compte ne peut pas être associé automatiquement. Réessayez avec le compte Discord habituel.',
  SessionRequired:
    'Votre session est absente ou a expiré. Reconnectez-vous pour retrouver votre progression.',
  Configuration:
    'Le service de connexion est indisponible. La configuration doit être vérifiée.',
};
export function authMessage(code: string | undefined) {
  return code
    ? ((Object.hasOwn(messages, code) ? messages[code] : undefined) ??
        'La connexion a échoué. Réessayez depuis cette page.')
    : '';
}
