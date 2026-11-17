import { test, expect } from 'vitest';
import {
  makeChallenge,
  matchesAnswer,
  challengeWords,
  challengeQuestions,
  puzzleWord,
} from '../../bot/challenge-content';
test('all five challenge types have a valid answer and enforce code case', () => {
  for (let kind = 0; kind < 5; kind++) {
    let first = true;
    const round = makeChallenge((max) => {
      if (first) {
        first = false;
        return kind;
      }
      return Math.min(1, max - 1);
    });
    expect(matchesAnswer(round, round.answers[0])).toBe(true);
    expect(matchesAnswer(round, 'definitely incorrect')).toBe(false);
    if (round.exact)
      expect(matchesAnswer(round, round.answers[0].toLowerCase())).toBe(false);
    if (kind === 3)
      expect(round.prompt).not.toContain('`' + round.answers[0] + '`');
    if (kind === 4) expect(round.prompt).toContain('_');
  }
});
function select(kind: number, index: number) {
  let call = 0;
  return makeChallenge((max) =>
    call++ === 0 ? kind : call === 2 ? index : Math.min(1, max - 1),
  );
}
test('the approved 100 words and 100 questions are selectable and have unique ids', () => {
  expect(challengeWords).toHaveLength(100);
  expect(challengeQuestions).toHaveLength(100);
  expect(new Set(challengeWords.map(puzzleWord)).size).toBe(100);
  expect(new Set(challengeQuestions.map((question) => question.id)).size).toBe(
    100,
  );
  challengeQuestions.forEach((question, index) => {
    const round = select(0, index);
    expect(round.prompt).toContain(question.question);
    expect(round.answers).toEqual(question.answers);
    question.answers.forEach((answer) =>
      expect(matchesAnswer(round, answer)).toBe(true),
    );
  });
});
test('all word challenges use the approved bank, preserve inversion and accept every compatible mask or anagram', () => {
  challengeWords.forEach((word, index) => {
    expect(select(1, index).answers).toEqual([word]);
    expect(select(2, index).answers).toEqual([[...word].reverse().join('')]);
    for (const kind of [3, 4]) {
      const round = select(kind, index);
      expect(matchesAnswer(round, word)).toBe(true);
      const shown = round.prompt.split('`')[1];
      if (kind === 3) {
        expect([...shown].sort()).toEqual([...puzzleWord(word)].sort());
        expect(shown).not.toBe(puzzleWord(word));
      } else expect(shown).toContain('_');
      const fits =
        kind === 3
          ? (candidate: string) =>
              [...puzzleWord(candidate)].sort().join('') ===
              [...shown].sort().join('')
          : (candidate: string) =>
              new RegExp('^' + shown.replaceAll('_', '[A-Z]') + '$').test(
                puzzleWord(candidate),
              );
      challengeWords
        .filter(fits)
        .forEach((candidate) =>
          expect(matchesAnswer(round, candidate)).toBe(true),
        );
    }
  });
  expect(
    matchesAnswer(select(4, challengeWords.indexOf('Sans-cœur')), 'Sans-coeur'),
  ).toBe(true);
});
test('word and question answers tolerate accents, case and surrounding spaces', () => {
  expect(
    matchesAnswer({ answers: ['lumiere'], exact: false }, '  LUMIÈRE '),
  ).toBe(true);
  expect(matchesAnswer({ answers: ['ABC123'], exact: true }, 'abc123')).toBe(
    false,
  );
});
