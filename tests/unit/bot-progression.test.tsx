// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { questEmbed, userMessage } from '../../bot/progression';
import { emptyActivity, questStatus } from '../../src/game/quests';

describe('bot : quêtes et messages', () => {
  it('liste les quêtes et compte celles à réclamer', () => {
    const quests = questStatus(
      [],
      { ...emptyActivity(), boosters: 99, cards: 999 },
      emptyActivity(),
      new Date('2026-11-18T12:00:00Z'),
    );
    const { embed, ready } = questEmbed(quests, 'daily');
    const json = embed.toJSON();
    expect(json.title).toBe('Quêtes du jour');
    expect(ready.length).toBeGreaterThan(0);
    expect(json.description).toContain(`${ready.length} à réclamer`);
    expect(json.description).toContain('✅');
  });
  it('montre les erreurs métier mais masque les erreurs techniques', () => {
    expect(userMessage(new Error('Quête non disponible'))).toBe(
      'Quête non disponible',
    );
    const pg = Object.assign(new Error('relation "Guild" does not exist'), {
      code: '42P01',
    });
    expect(userMessage(pg)).not.toContain('relation');
    expect(userMessage('boom')).toContain('temporairement indisponible');
  });
});
