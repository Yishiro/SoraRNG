import { z } from 'zod';
import { validateCatalog } from './core';
import { rarities, rates, holoRate } from './config';

const percent = z.number().min(0).max(100);
const sourceCard = z
  .object({
    id: z.string().regex(/^KH-\d{3}$/),
    personnage: z.string().trim().min(1),
    version: z.string().trim().min(1),
    origine: z.string().trim().min(1),
    rarete: z.enum(rarities),
    affinite: z.enum([
      'Lumière',
      'Ténèbres',
      'Neutre',
      'Magie',
      'Feu',
      'Glace',
      'Foudre',
      'Néant',
      'Rêve',
      'Vent',
      'Terre',
      'Espace',
      'Illusion',
      'Eau',
      'Temps',
      'Fleur',
      'Lune',
    ]),
    role: z.enum([
      'Polyvalent',
      'Attaquant',
      'Soutien',
      'Défenseur',
      'Mage',
      'Agile',
      'Collection',
      'Objet',
    ]),
    niveau_max: z.number().int().positive(),
    taux_modele_pct: percent,
    taux_holo_precis_pct: percent,
    finition_holo_pct: percent,
    obtenable: z.literal('Invocation RNG'),
    echangeable: z.literal('Oui'),
    illustration: z.string().min(1),
    notes: z.string(),
    type_carte: z.enum([
      'Personnage',
      'Personnage secondaire',
      'Objet souvenir',
      'Objet',
      'Matériau',
      'Objet emblématique',
      'Équipement collection',
      'Ennemi',
    ]),
  })
  .passthrough();
const sourceSchema = z
  .object({
    catalogue_version: z.string().min(1),
    total: z.literal(150),
    rarity_rates_percent: z
      .object({
        Commun: percent,
        Rare: percent,
        Épique: percent,
        Légendaire: percent,
        Mythique: percent,
        Secret: percent,
      })
      .strict(),
    holographic_rate_percent: percent,
    cards: z.array(sourceCard).length(150),
  })
  .passthrough();

// Source values are rounded decimal percentages, not alternate RNG weights.
const equalPercent = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= 1e-9;
export function parseSourceCatalog(input: unknown) {
  const source = sourceSchema.parse(input);
  rarities.forEach((rarity, index) => {
    if (
      !equalPercent(
        source.rarity_rates_percent[rarity],
        [5000, 2800, 1400, 600, 180, 20][index] / 100,
      )
    )
      throw new Error(`Taux de rareté incompatible : ${rarity}`);
  });
  if (!equalPercent(source.holographic_rate_percent, 2))
    throw new Error('Taux holographique incompatible');
  const cards = validateCatalog(
    source.cards.map((card) => ({
      ...card,
      name: card.personnage,
      origin: card.origine,
      rarity: card.rarete,
      affinity: card.affinite,
      type: card.type_carte,
      maxLevel: card.niveau_max,
    })),
  );
  for (const card of source.cards) {
    const eligible = source.cards.filter(
      (c) => c.rarete === card.rarete,
    ).length;
    const expected = source.rarity_rates_percent[card.rarete] / eligible;
    if (!equalPercent(card.taux_modele_pct, expected))
      throw new Error(`Probabilité individuelle incohérente : ${card.id}`);
    if (!equalPercent(card.finition_holo_pct, source.holographic_rate_percent))
      throw new Error(`Finition incohérente : ${card.id}`);
    if (
      !equalPercent(
        card.taux_holo_precis_pct,
        (expected * source.holographic_rate_percent) / 100,
      )
    )
      throw new Error(
        `Probabilité holographique précise incohérente : ${card.id}`,
      );
  }
  return { source, cards };
}

// The original catalogue remains an immutable reference. Live odds come from config.
export function liveCatalog(cards: import('./core').Card[]) {
  return cards.map((card) => {
    const modelRate =
      rates[rarities.indexOf(card.rarity)] /
      100 /
      cards.filter((c) => c.rarity === card.rarity).length;
    return {
      ...card,
      taux_modele_pct: modelRate,
      finition_holo_pct: holoRate / 100,
      taux_holo_precis_pct: (modelRate * holoRate) / 10000,
    };
  });
}
