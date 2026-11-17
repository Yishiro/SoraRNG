# Correction des doublons visuels locaux

Sur les 135 cartes illustrées en local, le premier audit trouvait 124 visuels uniques et 11 paires strictement identiques. Après remplacement de 10 références : **134 visuels uniques, une seule paire restante**. La comparaison porte sur les empreintes SHA-256 des sources et des fichiers WebP réellement présents, pas seulement sur les URL.

| Carte  | Référence locale retenue                                                          |
| ------ | --------------------------------------------------------------------------------- |
| KH-019 | Sora KH1 : illustration officielle distincte du rendu de KH-001                   |
| KH-020 | Riku KH1 : illustration officielle, même tenue ; arme non représentée             |
| KH-004 | Roxas KH2 : illustration en tenue de la Cité du Crépuscule                        |
| KH-024 | Xion Days : autre rendu de la même apparence humaine, sans transformation de boss |
| KH-049 | Ventus BBS : pose de combat                                                       |
| KH-050 | Terra BBS : pose de combat                                                        |
| KH-051 | Aqua BBS : pose de combat                                                         |
| KH-077 | Mickey KH2 : pose de combat, même tenue                                           |
| KH-100 | Xehanort KH3 : capture du combat final avec χ-blade                               |
| KH-098 | Yozora Re Mind : capture de préparation au combat secret                          |

Contrôle visuel effectué sur une planche privée des dix remplacements et sur le candidat final Riku. Le candidat initial Riku Battle KH1 représentait une épée en bois : il a été rejeté. L’illustration finale ne montre pas Soul Eater ; elle est explicitement décrite comme portrait représentatif, et non comme une preuve visuelle de l’arme.

KH-068 « Forme Souvenance » et KH-078 « Forme Limite » conservent le même visuel. Les deux intitulés désignent Limit Form : aucune tenue de Noël, autre monde ou autre transformation n’a été ajoutée artificiellement pour supprimer cette dernière répétition. Les deux identifiants de gameplay restent distincts. [Référence terminologique](https://kingdomhearts.fandom.com/fr/wiki/Forme_Souvenance).

Sources et métadonnées : `deduplication-research.json`. Résultat de l’audit : `duplicate-report.json`. Reproduction : `node scripts/audit-local-card-duplicates.mjs --contact-sheet`. La planche reste dans `.local/card-assets/qa/` et n’est pas publiée.

Toutes les images restent réservées au développement local. Les anciens liens sont conservés dans `previousReferences` du manifeste ; aucun droit de publication n’est ajouté. Le catalogue et les règles de gameplay ne sont pas modifiés.
