import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Reveal from '../../src/components/reveal';
const card = {
  id: 'fixture',
  name: 'Carte de test',
  version: 'Test',
  rarity: 'Secret' as const,
  type: 'Objet',
  origin: 'Test',
  affinity: 'Neutre',
  maxLevel: 70,
};
const copy = {
  id: 'copy',
  cardId: 'fixture',
  holo: true,
  level: 1,
  awakening: 0,
  locked: false,
  favorite: false,
};
test('même sans animation, retourner la carte est obligatoire avant de quitter', () => {
  const close = vi.fn();
  render(<Reveal cards={[card]} copies={[copy]} reduced onClose={close} />);
  const finish = screen.getByRole('button', { name: 'Continuer l’aventure' });
  expect(finish).toBeDisabled();
  expect(
    screen.queryByRole('heading', { name: 'Carte de test' }),
  ).not.toBeInTheDocument();
  fireEvent.click(finish);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 1' }));
  expect(
    screen.getByRole('heading', { name: 'Carte de test' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/✦ Holographique/).length).toBeGreaterThan(0);
  expect(finish).toBeEnabled();
  fireEvent.click(finish);
  expect(close).toHaveBeenCalledOnce();
});
test('passer la déchirure ne révèle aucune carte', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  try {
    render(
      <Reveal
        cards={[card]}
        copies={[copy]}
        reduced={false}
        onClose={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Passer la déchirure' }),
    );
    expect(
      screen.getByRole('button', { name: 'Retourner la carte 1' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Continuer l’aventure' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Tout révéler' }),
    ).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});
test('chaque carte doit être retournée, la fin de rotation est attendue', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const close = vi.fn();
  try {
    render(
      <Reveal
        cards={[card]}
        copies={[copy, { ...copy, id: 'second' }]}
        reduced={false}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Déchirer le sachet' }));
    act(() => vi.advanceTimersByTime(5200));
    fireEvent.click(
      screen.getByRole('button', { name: 'Retourner la carte 1' }),
    );
    expect(screen.getByRole('button', { name: 'Suivante' })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Passer à la carte 2' }),
    );
    expect(
      screen.getByRole('button', { name: 'Passer à la carte 2' }),
    ).toBeDisabled();
    act(() => vi.advanceTimersByTime(850));
    fireEvent.click(
      screen.getByRole('button', { name: 'Passer à la carte 2' }),
    );
    expect(
      screen.getByRole('button', { name: 'Continuer l’aventure' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retourner la carte 2' }),
    );
    expect(
      screen.getByRole('button', { name: 'Continuer l’aventure' }),
    ).toBeDisabled();
    act(() => vi.advanceTimersByTime(850));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
test('une ancienne carte absente du catalogue peut être retournée sans bloquer la sortie', () => {
  const close = vi.fn();
  render(<Reveal cards={[]} copies={[copy]} reduced onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 1' }));
  expect(screen.getByRole('heading', { name: 'fixture' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer l’aventure' }));
  expect(close).toHaveBeenCalledOnce();
});
test('un coffret exige les cinquante retournements, pas seulement le premier booster', () => {
  const close = vi.fn();
  const copies = Array.from({ length: 50 }, (_, i) => ({
    ...copy,
    id: `coffret-${i}`,
  }));
  render(<Reveal cards={[card]} copies={copies} reduced onClose={close} />);
  for (let i = 0; i < 50; i++) {
    expect(
      screen.getByRole('button', { name: 'Continuer l’aventure' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', {
        name: `Retourner la carte ${i + 1}`,
      }),
    );
    if (i < 49)
      fireEvent.click(screen.getByRole('button', { name: 'Suivante' }));
  }
  expect(
    screen.getByRole('button', { name: 'Continuer l’aventure' }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer l’aventure' }));
  expect(close).toHaveBeenCalledOnce();
});

test('cliquer sur une face retournée passe au dos suivant sans révéler la prochaine carte', () => {
  const close = vi.fn();
  render(
    <Reveal
      cards={[card]}
      copies={[copy, { ...copy, id: 'second' }]}
      reduced
      onClose={close}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Passer à la carte 2' }));
  expect(
    screen.getByRole('button', { name: 'Retourner la carte 2' }),
  ).toBeEnabled();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  expect(screen.getByRole('button', { name: 'Précédente' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Suivante' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Continuer l’aventure' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 2' }));
  expect(
    screen.queryByRole('button', { name: 'Passer à la carte 3' }),
  ).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Continuer l’aventure' }),
  ).toBeEnabled();
});

test('la légende reste cachée avant le retournement et correspond à la version révélée', () => {
  const island = { ...card, id: 'KH-001', version: 'Îles du Destin' };
  const keyblade = { ...card, id: 'KH-019', version: 'Porteur de Keyblade' };
  render(
    <Reveal
      cards={[island, keyblade]}
      copies={[
        { ...copy, cardId: island.id },
        { ...copy, id: 'second', cardId: keyblade.id },
      ]}
      reduced
      onClose={() => {}}
    />,
  );
  expect(
    screen.queryByLabelText('Légende de la carte'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 1' }));
  expect(screen.getByLabelText('Légende de la carte')).toHaveTextContent(
    'Sur le rivage',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Passer à la carte 2' }));
  expect(
    screen.queryByLabelText('Légende de la carte'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retourner la carte 2' }));
  expect(screen.getByLabelText('Légende de la carte')).toHaveTextContent(
    'Une clé entre les mains',
  );
});
