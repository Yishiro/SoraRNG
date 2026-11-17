import { writeFile } from 'node:fs/promises';
const prefixes = [
  'Meow Wow',
  'Komory Bat',
  'Roxas',
  'Axel',
  'Meowjesty',
  'Vexen',
  'Lexaeus',
  'Zexion',
  'Marluxia',
  'Larxene',
  'Eraqus',
  'Master Eraqus',
  'Chirithy',
  'Terra',
  'Ventus',
  'Riku',
  'Vanitas',
  'Kairi',
  'Goofy',
  'Donald Duck',
  'Mickey Mouse',
  'Potion',
  'Ether',
  'Sea-salt',
  'Paopu',
  'Hi-Potion',
  'Mega-Potion',
  'Mega-Ether',
  'Elixir',
  'Megalixir',
  'Wayfinder',
  'Lucky Charm',
];
const results = {};
for (const prefix of prefixes) {
  const p = new URLSearchParams({
    action: 'query',
    list: 'allimages',
    aiprefix: prefix,
    ailimit: '500',
    format: 'json',
  });
  const r = await fetch(`https://www.khwiki.com/api.php?${p}`, {
    signal: AbortSignal.timeout(30000),
  });
  const b = await r.json();
  results[prefix] = (b.query?.allimages ?? [])
    .map((x) => x.name)
    .filter(
      (n) =>
        !/Sprite|Portrait|Tamagotchi|Figure|Manga|KHUX|KHDR|TCG|DTT|BoD-|_Card|_Art\)|Mystery|Vinimates|Funko|Nendoroid|Merchandise|Station|FFRK|FFBE|Fortnite|KHCOM|\.ogg|\.gif|SSBU|_0[1-9]_|_Novel/i.test(
          n,
        ),
    );
}
await writeFile(
  'docs/assets/prefix-searches.json',
  JSON.stringify(results, null, 2),
);
for (const [prefix, names] of Object.entries(results))
  console.log(
    prefix +
      ': ' +
      names
        .filter((n) => /_(KH|KHBBS|KHII|KHIII|KH3D|KHIIFM|KH0.2|KHX)\./.test(n))
        .join(', '),
  );
