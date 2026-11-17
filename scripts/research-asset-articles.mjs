const titles = [
  'Potion',
  'Ether',
  'Hi-Potion',
  'Mega-Potion',
  'Mega-Ether',
  'Elixir',
  'Megalixir',
  'Sea-salt ice cream',
  'Wayfinder',
  'Terra',
  'Ventus',
  'Vanitas',
  'Axel',
  'Vexen',
  'Lexaeus',
  'Zexion',
  'Marluxia',
  'Larxene',
];
for (const title of titles) {
  const p = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'images',
    imlimit: '500',
    redirects: '1',
    format: 'json',
  });
  const b = await (await fetch('https://www.khwiki.com/api.php?' + p)).json();
  const imgs = Object.values(b.query?.pages ?? {})
    .flatMap((x) => x.images ?? [])
    .map((x) => x.title)
    .filter(
      (n) =>
        !/(?:icon|Sprite|\.ogg|\.gif|Manga|Novel|Attack|Keyblade Graveyard|Location|KHUX|KHDR|\.svg)/i.test(
          n,
        ),
    );
  console.log(title + ': ' + imgs.join(' | '));
}
