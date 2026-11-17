import { catalog } from '../../../src/server/game';
import { rarities, rates, economy, holoRate } from '../../../src/game/config';
export async function GET() {
  try {
    const cards = await catalog();
    return Response.json({
      cards,
      rateVersion: 'standard-v2',
      holoRate: holoRate / 10000,
      cardsPerBooster: economy.cardsPerBooster,
      probabilities: cards.map((c) => ({
        id: c.id,
        probability:
          rates[rarities.indexOf(c.rarity)] /
          10000 /
          cards.filter((k) => k.rarity === c.rarity).length,
      })),
    });
  } catch {
    return Response.json({ error: 'Catalogue indisponible' }, { status: 503 });
  }
}
