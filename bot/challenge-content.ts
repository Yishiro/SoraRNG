import { randomInt } from 'node:crypto';
import bank from './challenge-bank.json';
export const challengeWords = bank.words.map((entry) => entry.word);
export const challengeQuestions = bank.questions;
export type ChallengeContent = {
  kind: string;
  prompt: string;
  answers: string[];
  exact: boolean;
};
export function normalizeAnswer(value: string, exact: boolean) {
  const trimmed = value.trim();
  return exact
    ? trimmed
    : trimmed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('fr')
        .replace(/œ/g, 'oe')
        .replace(/[’'\-]/g, ' ')
        .replace(/\s+/g, ' ');
}
export function matchesAnswer(
  content: Pick<ChallengeContent, 'answers' | 'exact'>,
  answer: string,
) {
  return content.answers.some(
    (value) =>
      normalizeAnswer(value, content.exact) ===
      normalizeAnswer(answer, content.exact),
  );
}
export function puzzleWord(word: string) {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}
function wordAnswers(words: string[]) {
  return [...new Set(words.flatMap((word) => [word, puzzleWord(word)]))];
}
export function makeChallenge(
  rng: (max: number) => number = randomInt,
): ChallengeContent {
  const kind = rng(5);
  if (kind === 0) {
    const question = challengeQuestions[rng(challengeQuestions.length)];
    return {
      kind: 'question',
      prompt: `${question.question}\n\n*${question.scope}*`,
      answers: [...question.answers],
      exact: false,
    };
  }
  const word = challengeWords[rng(challengeWords.length)];
  if (kind === 1 || kind === 2)
    return {
      kind: kind === 1 ? 'copie' : 'inverse',
      prompt: `${kind === 1 ? 'Recopiez exactement ce nom Kingdom Hearts (majuscules et accents compris)' : 'Écrivez ce nom Kingdom Hearts à l’envers, caractère par caractère (espaces, majuscules et accents compris)'} :\n\`${word}\``,
      answers: [kind === 1 ? word : [...word].reverse().join('')],
      exact: true,
    };
  const compact = puzzleWord(word);
  if (kind === 3) {
    const letters = [...compact];
    for (let i = letters.length - 1; i > 0; i--) {
      const j = rng(i + 1);
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    if (letters.join('') === compact) letters.push(letters.shift()!);
    const signature = (value: string) => [...puzzleWord(value)].sort().join('');
    return {
      kind: 'melange',
      prompt: `Retrouvez le nom Kingdom Hearts dont les lettres ont été mélangées (espaces et accents retirés) :\n\`${letters.join('')}\``,
      answers: wordAnswers(
        challengeWords.filter(
          (candidate) => signature(candidate) === signature(word),
        ),
      ),
      exact: false,
    };
  }
  const mask = [...compact]
    .map((letter, index) => (index % 2 ? '_' : letter))
    .join('');
  const pattern = new RegExp('^' + mask.replaceAll('_', '[A-Z]') + '$');
  return {
    kind: 'trous',
    prompt: `Complétez ce nom Kingdom Hearts (un _ = une lettre ; espaces et accents retirés) :\n\`${mask}\``,
    answers: wordAnswers(
      challengeWords.filter((candidate) => pattern.test(puzzleWord(candidate))),
    ),
    exact: false,
  };
}
