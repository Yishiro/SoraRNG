// Guildes et tableau d'annonces : règles partagées par le serveur et l'interface.
import { missionPeriods } from './missions';

export const guildRules = {
  createCost: 10000,
  maxMembers: 20,
  // Objectif hebdomadaire commun (semaine UTC, du lundi au lundi).
  weeklyBoosters: 150,
  weeklyReward: 2000,
  // Il faut avoir rejoint la guilde au moins 72 h avant la fin de la semaine
  // pour toucher sa récompense : on ne rejoint pas une guilde déjà gagnante.
  joinBeforeEndMs: 72 * 3600000,
} as const;

export const boardRules = {
  cost: 500,
  durationMs: 24 * 3600000,
  maxActive: 3,
  maxLength: 280,
  maxCards: 6,
} as const;

export const announcementKinds = {
  seek: 'Je cherche',
  offer: 'Je propose',
  other: 'Annonce',
} as const;
export type AnnouncementKind = keyof typeof announcementKinds;

export function cleanGuildName(input: unknown) {
  if (typeof input !== 'string') throw new Error('Nom de guilde invalide.');
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 24)
    throw new Error('Le nom de guilde doit faire de 3 à 24 caractères.');
  if (!/^[\p{L}\p{N} '’\-]+$/u.test(name))
    throw new Error(
      'Lettres, chiffres, espaces, apostrophes et tirets seulement.',
    );
  return name;
}

export function cleanAnnouncement(text: unknown) {
  if (typeof text !== 'string') throw new Error('Annonce invalide.');
  // Texte brut uniquement (affiché sans HTML), espaces et retours compactés.
  const clean = text
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (clean.length < 5 || clean.length > boardRules.maxLength)
    throw new Error(
      `L’annonce doit faire de 5 à ${boardRules.maxLength} caractères.`,
    );
  return clean;
}

// Semaine de l'objectif de guilde : identique à celle des quêtes hebdomadaires.
export function guildWeek(now: Date) {
  const { week, weeklyReset } = missionPeriods(now);
  return {
    key: week.toISOString().slice(0, 10),
    start: week,
    end: weeklyReset,
  };
}

export function previousGuildWeek(now: Date) {
  return guildWeek(new Date(guildWeek(now).start.getTime() - 1));
}

export const guildClaimKey = (week: string) => `guild-reward:${week}`;
