import Image from 'next/image';
const cast = [
  { id: 'KH-002', name: 'Riku' },
  { id: 'KH-001', name: 'Sora' },
  { id: 'KH-003', name: 'Kairi' },
];
export default function CollectionCover() {
  return (
    <div
      className="collection-cover"
      aria-label="Aperçu de la collection : Riku, Sora et Kairi"
    >
      <div className="cover-masthead">
        <span>LES ÎLES DU DESTIN</span>
        <span>01 — 03</span>
      </div>
      <div className="cover-cast">
        {cast.map((person) => (
          <figure
            key={person.id}
            className={
              person.name === 'Sora'
                ? 'cover-character cover-character-lead'
                : 'cover-character'
            }
          >
            <div className="cover-portrait">
              <Image
                src={`/assets/cards/${person.id}.webp`}
                alt={person.name}
                fill
                unoptimized
                sizes="(max-width:700px) 30vw, 190px"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <figcaption>
              <strong>{person.name}</strong>
              <span>{person.id}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="cover-colophon">
        <span>ÉDITION 01</span>
        <span>PERSONNAGES · OBJETS · CRÉATURES</span>
      </div>
    </div>
  );
}
