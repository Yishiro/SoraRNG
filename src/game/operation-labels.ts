// Libellés français des opérations enregistrées dans "Operation" et "EconomyOperation".
const labels: Record<string, string> = {
  baseline: 'État initial du journal',
  'account.create': 'Création du compte',
  unattributed: 'Modification sans attribution',
  daily: 'Bonus quotidien',
  bonus: 'Bonus Discord',
  deposit: 'Dépôt en banque',
  withdraw: 'Retrait bancaire',
  donate: 'Don',
  double: 'Double ou rien',
  roulette: 'Roulette',
  coinflip: 'Pile ou face',
  dice: 'Duel de dés',
  guess: 'Nombre mystère',
  summon: 'Ouverture de booster',
  shop: 'Boutique',
  mission: 'Récompense de quête',
  settings: 'Préférences',
  lock: 'Verrouillage d’une carte',
  favorite: 'Favori',
  wishlist: 'Liste de souhaits',
  showcase: 'Vitrine',
  recycle: 'Recyclage',
  upgrade: 'Amélioration',
  awaken: 'Éveil',
  awakening: 'Éveil',
  trade: 'Échange direct',
  'admin.adjust': 'Ajustement staff',
  'resources.adjust': 'Ajustement staff',
  'auction.bid': 'Mise / remboursement aux enchères',
  'auction.settle': 'Fin d’enchère',
  'auction.create': 'Mise en vente',
  'challenge.answer': 'Défi remporté',
};

export function operationLabel(kind: string) {
  return labels[kind] ?? labels[kind.split('.')[0]] ?? kind;
}

export function signedMunny(delta: number) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toLocaleString('fr-FR')} Munny`;
}
