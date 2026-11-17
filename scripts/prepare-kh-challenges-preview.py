"""Build review artifacts only. Does not modify the running challenge bank."""
import json
import pathlib
import unicodedata
from urllib.parse import quote

root = pathlib.Path(__file__).resolve().parents[1]
official = 'https://www.square-enix.com/kingdomhearts/about/fr/'
wiki = 'https://www.khwiki.com/'
questions = []

def add(category, question, answers, source, scope):
    questions.append(dict(id=f'KHQ-{len(questions)+1:03}', category=category, question=question,
        answers=answers.split('|'), scope=scope, source_url=source,
        source_kind='officielle' if 'square-enix.com' in source or 'blog.playstation.com' in source else 'communautaire',
        review_status='proposition_a_relire', checked_on='2026-10-30'))

core = [
('Quel héros principal voyage avec Donald et Dingo ?', 'Sora'),
('Quel compagnon de Sora est le magicien de la cour royale ?', 'Donald|Donald Duck'),
('Quel compagnon de Sora combat avec un bouclier ?', 'Dingo|Goofy'),
('Qui est le roi du Château Disney ?', 'Mickey|Roi Mickey|Mickey Mouse'),
('Comment s’appelle le type d’arme en forme de clé manié par Sora ?', 'Keyblade'),
('Quel personnage est surnommé « Ven » par ses amis ?', 'Ventus'),
('Quelle héroïne étudie auprès du même maître que Terra et Ventus ?', 'Aqua'),
('Quelle amie Sora et Riku recherchent-ils après sa disparition des îles du Destin ?', 'Kairi'),
]
for q,a in core: add('Personnages',q,a,official,'Présentation générale de la série')
base = [
('Quel maître entraîne Terra, Aqua et Ventus dans Birth by Sleep ?', 'Eraqus|Maître Eraqus', 'https://www.kingdomhearts.com/kh25manual/kingdom_hearts_25_manual_us.pdf','Birth by Sleep'),
('Quel épisode suit les trois protagonistes Terra, Aqua et Ventus ?', 'Birth by Sleep|Kingdom Hearts Birth by Sleep|BBS','https://blog.playstation.com/archive/2010/05/17/kingdom-hearts-birth-by-sleep-coming-this-september/','Épisode original'),
('De quel personnage Roxas est-il le Simili ?', 'Sora',wiki+'Roxas','Identité de Roxas'),
('Quel personnage contrôle-t-on dans le prologue de Kingdom Hearts II ?', 'Roxas',wiki+'Roxas','Kingdom Hearts II'),
('Dans quelle ville Roxas, Axel et Xion mangent-ils des glaces sur une tour de l’horloge ?', 'Cité du Crépuscule|Twilight Town',wiki+'Sea-salt_ice_cream','358/2 Days'),
('À quel parfum sont les glaces emblématiques partagées par Roxas, Axel et Xion ?', 'Sel de mer|Au sel de mer|Glace au sel de mer|Sea salt',wiki+'Sea-salt_ice_cream','358/2 Days'),
('Quel est le prénom de l’être humain dont Axel est le Simili ?', 'Lea',wiki+'Axel','Identité d’Axel'),
('Quel type d’armes Axel utilise-t-il au sein de l’Organisation XIII ?', 'Chakrams|Chakram',wiki+'Axel','Axel, et non sa version Lea porteur de Keyblade'),
('Quel élément Axel maîtrise-t-il ?', 'Feu|Le feu|Flammes',wiki+'Axel','Organisation XIII'),
('Xion est-elle une réplique ou un Simili ordinaire ?', 'Réplique|Une réplique|Replica',wiki+'Xion','Nature de Xion'),
('Dans quel jeu Xion fait-elle sa première apparition ?', '358/2 Days|Kingdom Hearts 358/2 Days',wiki+'Xion','Première apparition publiée'),
('Quel numéro Xion reçoit-elle dans l’Organisation XIII ?', '14|XIV|Quatorze',wiki+'Xion','Membre supplémentaire présenté dans 358/2 Days'),
('De quel personnage Naminé est-elle le Simili ?', 'Kairi',wiki+'Namin%C3%A9','Identité de Naminé'),
('Quel personnage blond peut manipuler les souvenirs de Sora dans Chain of Memories ?', 'Naminé',wiki+'Namin%C3%A9','Chain of Memories'),
('Quel pseudonyme Ansem le Sage utilise-t-il lorsqu’il cache son identité ?', 'DiZ',wiki+'Ansem_the_Wise','Ansem le Sage, pas le Chercheur des Ténèbres'),
('Quel est le nom complet du personnage surnommé Leon ?', 'Squall Leonhart|Squall',wiki+'Leon','Identité de Leon'),
('Quel petit compagnon tient le journal des aventures de Sora ?', 'Jiminy|Jiminy Grillon|Jiminy Cricket',wiki+'Jiminy_Cricket','Journal de Jiminy'),
('Quel mécanicien de la Ville de Traverse aide Sora avec le vaisseau Gummi dans le premier jeu ?', 'Cid',wiki+'Cid','Kingdom Hearts I'),
('Quelles petites créatures au pompon tiennent notamment des ateliers de synthèse ?', 'Mogs|Mog|Moogles|Moogle',wiki+'Moogle','Ateliers de synthèse'),
('Quel ancien maître du Roi Mickey vit dans la Tour Mystérieuse ?', 'Yen Sid|Yensid',wiki+'Yen_Sid','Mentor du Roi Mickey'),
]
for q,a,s,scope in base: add('Personnages',q,a,s,scope)

members = [('I','Xemnas'),('II','Xigbar'),('III','Xaldin'),('IV','Vexen'),('V','Lexaeus'),('VI','Zexion'),('VII','Saïx'),('VIII','Axel'),('IX','Demyx'),('X','Luxord'),('XI','Marluxia'),('XII','Larxene'),('XIII','Roxas')]
for number,name in members:
    add('Organisation XIII',f'Qui porte le numéro {number} dans l’Organisation XIII d’origine ?',name,wiki+quote(name),'Organisation d’origine : pas la véritable Organisation de KH III')
weapons=[('Xaldin','Lances|Lance'),('Vexen','Bouclier|Un bouclier'),('Zexion','Livre|Un livre|Lexique|Lexicon'),('Demyx','Sitar|Un sitar'),('Luxord','Cartes|Des cartes|Cartes à jouer'),('Marluxia','Faux|Une faux')]
for name,answer in weapons:
    add('Armes',f'Quel type d’arme {name} utilise-t-il dans l’Organisation XIII ?',answer,wiki+name,'Arme du membre de l’Organisation d’origine')

worlds=[
('Pays des Merveilles','Alice au pays des merveilles|Alice in Wonderland','Wonderland','Kingdom Hearts I'),
('Agrabah','Aladdin','Agrabah','Kingdom Hearts I'),
('Atlantica','La Petite Sirène|The Little Mermaid','Atlantica','Kingdom Hearts I'),
('Ville d’Halloween','L’Étrange Noël de monsieur Jack|L’Étrange Noël de Mr Jack|The Nightmare Before Christmas','Halloween_Town','Kingdom Hearts I'),
('Pays Imaginaire','Peter Pan','Neverland','Kingdom Hearts I'),
('Terre des Lions','Le Roi Lion|The Lion King','Pride_Lands','Kingdom Hearts II ; Pride Lands en anglais'),
('Terre des Dragons','Mulan','The_Land_of_Dragons','Kingdom Hearts II'),
('Château de la Bête','La Belle et la Bête|Beauty and the Beast',"Beast%27s_Castle",'Kingdom Hearts II'),
('Space Paranoids','Tron','Space_Paranoids','Kingdom Hearts II ; nom anglais du monde indiqué pour éviter une confusion avec La Grille'),
('Jungle Profonde','Tarzan','Deep_Jungle','Kingdom Hearts I'),
('Monstro','Pinocchio','Monstro','Kingdom Hearts I'),
('Forêt des Rêves Bleus','Winnie l’ourson|Winnie the Pooh|Les Aventures de Winnie l’ourson','100_Acre_Wood','Monde de Winnie'),
]
for world,film,page,scope in worlds:
    add('Mondes et films',f'De quel film Disney le monde « {world} » est-il issu ?',film,wiki+page,scope)
allies=[
('Kingdom Hearts I','Agrabah','Aladdin','Agrabah'),
('Kingdom Hearts I','Atlantica','Ariel','Atlantica'),
('Kingdom Hearts I','Ville d’Halloween','Jack Skellington|Jack','Halloween_Town'),
('Kingdom Hearts I','Pays Imaginaire','Peter Pan','Neverland'),
('Kingdom Hearts II','Terre des Lions','Simba','Pride_Lands'),
('Kingdom Hearts II','Terre des Dragons, après avoir révélé sa véritable identité','Mulan','The_Land_of_Dragons'),
('Kingdom Hearts II','Château de la Bête','La Bête|Bête|Beast',"Beast%27s_Castle"),
('Kingdom Hearts II','Space Paranoids','Tron','Space_Paranoids'),
('Kingdom Hearts II','Colisée de l’Olympe, en tant que guerrier venu de Final Fantasy X','Auron','Olympus_Coliseum'),
('Kingdom Hearts II','Port Royal','Jack Sparrow|Capitaine Jack Sparrow','Port_Royal'),
]
for game,world,answer,page in allies:
    add('Alliés',f'Dans {game}, quel allié peut rejoindre l’équipe de Sora à {world} ?',answer,wiki+page,game)

kh3=[
('De quel film Pixar le monde Toy Box s’inspire-t-il ?', 'Toy Story','Toy_Box'),
('De quel film Disney le monde Arendelle s’inspire-t-il ?', 'La Reine des Neiges|Frozen','Arendelle'),
('De quel film Disney le Royaume de Corona s’inspire-t-il ?', 'Raiponce|Tangled','Kingdom_of_Corona'),
('De quel film Pixar le monde Monstropolis s’inspire-t-il ?', 'Monstres et Cie|Monstres & Cie|Monsters Inc|Monsters, Inc.','Monstropolis'),
('De quel film Disney le monde San Fransokyo s’inspire-t-il ?', 'Les Nouveaux Héros|Big Hero 6','San_Fransokyo'),
('Quel pirate accompagne Sora dans le monde des Caraïbes ?', 'Jack Sparrow|Capitaine Jack Sparrow','The_Caribbean'),
('Quel jouet cowboy Sora rencontre-t-il à Toy Box ?', 'Woody','Toy_Box'),
('Quel ranger de l’espace accompagne Woody à Toy Box ?', 'Buzz|Buzz l’Éclair|Buzz Lightyear','Toy_Box'),
('Quel robot blanc est l’allié de Sora à San Fransokyo ?', 'Baymax','San_Fransokyo'),
('À Arendelle, comment s’appelle la sœur d’Elsa ?', 'Anna','Arendelle'),
('Quel monstre vert à un seul œil accompagne Sora à Monstropolis ?', 'Bob|Bob Razowski|Mike|Mike Wazowski','Monstropolis'),
('Quel grand monstre bleu et poilu accompagne Sora à Monstropolis ?', 'Sulli|Sully|Sulley|Jacques Sullivan|James P. Sullivan','Monstropolis'),
]
for q,a,page in kh3: add('Kingdom Hearts III',q,a,wiki+page,'Kingdom Hearts III')
mechanics=[
('Comment s’appelle le fruit étoilé emblématique des îles du Destin ?', 'Paopu|Fruit Paopu|Un Paopu','Paopu_Fruit','Fruit des îles du Destin'),
('Qui fabrique les trois porte-bonheur pour Terra, Ventus et elle-même dans Birth by Sleep ?', 'Aqua','Wayfinder','Birth by Sleep'),
('Dans Kingdom Hearts II, quelle forme de fusion habille Sora en rouge ?', 'Vaillance|Forme Vaillance|Valor|Valor Form','Drive_Form','Formes de fusion de KH II'),
('Dans Kingdom Hearts II, quelle forme de fusion habille Sora en bleu et utilise Donald ?', 'Sagesse|Forme Sagesse|Wisdom|Wisdom Form','Drive_Form','Formes de fusion de KH II'),
('Dans Kingdom Hearts II, quelle forme de fusion habille Sora en jaune ?', 'Maîtrise|Forme Maîtrise|Master|Master Form','Drive_Form','Formes de fusion de KH II'),
('Dans Kingdom Hearts II, quelle forme de fusion donne à Sora des vêtements argentés et deux Keyblades en lévitation ?', 'Suprême|Forme Suprême|Final|Final Form','Drive_Form','Formes de fusion de KH II'),
('Combien de couleurs de marques Trio peut-on apprendre à activer dans le premier Kingdom Hearts ?', '5|Cinq','Trinity_Mark','Marques Trio d’exploration, pas la compétence de combat'),
('Quel est le nom anglais de la forme par défaut de la première Keyblade de Sora ?', 'Kingdom Key','Kingdom_Key','Nom anglais demandé explicitement'),
('Comment appelle-t-on les ennemis Heartless dans la version française ?', 'Sans-cœur|Sans-coeur|Sans cœur|Sans coeur','Heartless','Traduction française'),
]
for q,a,page,scope in mechanics: add('Objets et systèmes',q,a,wiki+page,scope)
games=[
('Sur quelle console le premier Kingdom Hearts est-il sorti à l’origine ?', 'PlayStation 2|PS2','Kingdom_Hearts_(game)'),
('En quelle année le premier Kingdom Hearts est-il sorti au Japon ?', '2002','Kingdom_Hearts_(game)'),
('Sur quelle console Kingdom Hearts II est-il sorti à l’origine ?', 'PlayStation 2|PS2','Kingdom_Hearts_II'),
('Sur quelle console Chain of Memories est-il sorti à l’origine, avant son remake Re:Chain of Memories ?', 'Game Boy Advance|GBA','Kingdom_Hearts_Chain_of_Memories'),
('Sur quelle console Kingdom Hearts 358/2 Days est-il sorti à l’origine ?', 'Nintendo DS|DS','Kingdom_Hearts_358/2_Days'),
('Sur quelle console Birth by Sleep est-il sorti à l’origine ?', 'PSP|PlayStation Portable','Kingdom_Hearts_Birth_by_Sleep'),
('Sur quelle console Dream Drop Distance est-il sorti à l’origine, avant sa version HD ?', 'Nintendo 3DS|3DS','Kingdom_Hearts_3D:_Dream_Drop_Distance'),
('Quel épisode Kingdom Hearts est un jeu de rythme centré sur les musiques de la série ?', 'Melody of Memory|Kingdom Hearts Melody of Memory','Kingdom_Hearts_Melody_of_Memory'),
('Quel est le titre anglais de la chanson principale du premier Kingdom Hearts ?', 'Simple and Clean','Kingdom_Hearts_(game)'),
('Quel est le titre anglais de la chanson principale de Kingdom Hearts II ?', 'Sanctuary','Kingdom_Hearts_II'),
]
for q,a,page in games: add('Épisodes et musiques',q,a,wiki+page,'Versions et sorties originales explicitement distinguées des remasters')

words=[]
def group(category, pairs):
    for label,page in pairs:
        words.append(dict(id=f'KHW-{len(words)+1:03}',word=label,category=category,source_url=wiki+page,source_kind='communautaire',review_status='proposition_a_relire'))

group('Personnages originaux',[(name,quote(name)) for name in ['Sora','Riku','Kairi','Roxas','Axel','Xion','Naminé','Aqua','Terra','Ventus','Vanitas','Eraqus','Xehanort','Ansem','Xemnas','Xigbar','Xaldin','Vexen','Lexaeus','Zexion','Saïx','Demyx','Luxord','Marluxia','Larxene','Lea','Isa','Ienzo','Even','Aeleus','Dilan','Braig','Lauriam','Elrena','Hayner','Pence','Olette']])
group('Personnages Disney',[
('Mickey','Mickey_Mouse'),('Donald','Donald_Duck'),('Dingo','Goofy'),('Minnie','Minnie_Mouse'),('Pluto','Pluto'),('Maléfique','Maleficent'),('Pat Hibulaire','Pete'),('Yen Sid','Yen_Sid'),('Jiminy','Jiminy_Cricket'),('Aladdin','Aladdin'),('Jasmine','Jasmine'),('Jafar','Jafar'),('Simba','Simba'),('Mulan','Mulan'),('Mushu','Mushu'),('Hercule','Hercules'),('Hadès','Hades'),('Auron','Auron'),('Stitch','Stitch'),('Peter Pan','Peter_Pan'),('Clochette','Tinker_Bell'),('Alice','Alice'),('Pinocchio','Pinocchio'),('Geppetto','Geppetto'),('Jack Skellington','Jack_Skellington'),('Sally','Sally'),('Jack Sparrow','Jack_Sparrow'),('Barbossa','Barbossa'),('Ariel','Ariel'),('Ursula','Ursula'),('Woody','Woody'),('Buzz','Buzz_Lightyear'),('Elsa','Elsa'),('Anna','Anna'),('Olaf','Olaf'),('Baymax','Baymax'),('Tron','Tron')])
group('Mondes',[
('Agrabah','Agrabah'),('Atlantica','Atlantica'),('Illusiopolis','The_World_That_Never_Was'),('Arendelle','Arendelle'),('Monstropolis','Monstropolis'),('San Fransokyo','San_Fransokyo'),('Îles du Destin','Destiny_Islands'),('Ville de Traverse','Traverse_Town'),('Cité du Crépuscule','Twilight_Town'),('Jardin Radieux','Radiant_Garden'),('Forteresse Oubliée','Hollow_Bastion'),('Château Disney','Disney_Castle'),('Contrée du Départ','Land_of_Departure'),('Pays Imaginaire','Neverland'),('Jungle Profonde','Deep_Jungle'),('Monstro','Monstro'),('Port Royal','Port_Royal'),('Château de la Bête',"Beast%27s_Castle"),('Ville d’Halloween','Halloween_Town'),('Forêt des Rêves Bleus','100_Acre_Wood')])
group('Objets et termes', [('Keyblade','Keyblade'),('Paopu','Paopu_Fruit'),('Mog','Moogle'),('Sans-cœur','Heartless'),('Simili','Nobody'),('Munny','Munny')])

# Auron is a Final Fantasy guest, not a Disney character.
next(word for word in words if word['word']=='Auron')['category']='Invité Final Fantasy'
assert len(words)==100, len(words)
assert len(questions)==100, len(questions)
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).casefold() if not unicodedata.combining(c))
assert len({norm(w['word']) for w in words})==100
assert len({norm(q['question']) for q in questions})==100
assert all(q['answers'] and all(a.strip() for a in q['answers']) for q in questions)
data=dict(status='preview_not_active',language='fr',word_count=100,question_count=100,checked_on='2026-10-30',
    notes=['Sources officielles et communautaires distinguées ; aucune garantie d’infaillibilité.',
           'Questions et graphies françaises à relire avant activation. Spoilers possibles.',
           'Nom de source présent ne remplace pas une vérification éditoriale indépendante.',
           'Les mots peuvent être des noms propres ou expressions ; les masques ambigus devront accepter toutes les solutions valides de la banque.'],
    words=words,questions=questions)
out=root/'data'/'kh-challenges-preview.json';out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Proposition : 100 mots et 100 questions Kingdom Hearts','',
       '**Statut : aperçu à relire, non activé sur le bot.** Les réponses révèlent certains éléments de l’histoire.',
       'Sources officielles et communautaires sont indiquées séparément. Une source associée ne constitue pas une garantie absolue d’absence d’erreur.',
       '', '## Les 100 mots et noms', '', '| N° | Mot ou nom | Catégorie | Référence |','|---|---|---|---|']
for w in words: lines.append(f"| {w['id']} | {w['word']} | {w['category']} | [KH Wiki]({w['source_url']}) |")
lines+=['','## Les 100 questions et réponses','','Les variantes séparées par « / » seraient acceptées ; casse et accents seraient ignorés pour les questions. Le périmètre précise l’épisode ou la version lorsqu’une confusion est possible.','']
for q in questions:
    lines += [f"### {q['id']} · {q['category']}",q['question'],'',f"**Réponses acceptées :** {' / '.join(q['answers'])}",f"**Périmètre :** {q['scope']}",f"**Source {q['source_kind']} :** [consulter]({q['source_url']})",'']
(root/'docs'/'KH_CHALLENGES_PREVIEW.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Preview generated: 100 unique words, 100 unique questions; runtime bank unchanged.')

if __name__=='__main__': pass
