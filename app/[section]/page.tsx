import { notFound } from 'next/navigation';
import Game from '../../src/components/game';
const sections = [
  'dashboard',
  'summon',
  'collection',
  'codex',
  'upgrade',
  'shop',
  'missions',
  'settings',
  'trade',
  'exchanges',
  'guild',
  'board',
  'worlds',
  'events',
  'arena',
  'leaderboards',
  'admin',
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <Game section={section} />;
}
