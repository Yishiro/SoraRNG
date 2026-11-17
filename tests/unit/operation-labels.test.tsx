import { describe, expect, it } from 'vitest';
import { operationLabel, signedMunny } from '../../src/game/operation-labels';

describe('libellés du journal', () => {
  it('traduit les opérations du site et de l’économie', () => {
    expect(operationLabel('summon')).toBe('Ouverture de booster');
    expect(operationLabel('admin.adjust')).toBe('Ajustement staff');
    expect(operationLabel('guess.attempt')).toBe('Nombre mystère');
  });
  it('garde le code d’une opération inconnue', () => {
    expect(operationLabel('inconnu')).toBe('inconnu');
  });
  it('formate les montants signés', () => {
    expect(signedMunny(-1000)).toBe(`−1${' '}000 Munny`);
    expect(signedMunny(5000)).toBe(`+5${' '}000 Munny`);
  });
});
