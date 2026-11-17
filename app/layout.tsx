import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'SoraRNG — Collection Kingdom Hearts',
  description:
    'Collectionnez 150 cartes Kingdom Hearts, ouvrez des boosters et complétez votre Codex.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
