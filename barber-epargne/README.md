# Coffre

App perso pour suivre ce que je gagne chaque week-end et mon épargne pour le mariage.

Le montant que je saisis est **divisé par 2 automatiquement** : seule ma part compte dans tous les calculs.

## Ouvrir l'app sur un ordinateur (sans rien installer)

Double-clique sur **`dist/index.html`**. Ne pas ouvrir le `index.html` à la racine du projet : c'est le fichier source, il ne s'affiche pas seul.

## Lancer en local (pour modifier le code)

```bash
npm install
npm run dev
```

## Tests des calculs

```bash
npm test
```

## Mettre l'app sur l'iPhone

1. Construire l'app : `npm run build`. Le résultat est dans le dossier `dist`.
2. Aller sur https://app.netlify.com/drop et glisser le dossier `dist`. Netlify donne une adresse en `https://….netlify.app`.
3. Ouvrir cette adresse dans **Safari** sur l'iPhone, appuyer sur **Partager**, puis **Sur l'écran d'accueil**.

L'app s'ouvre alors en plein écran comme une vraie app et fonctionne hors ligne.

## Comptes et sauvegarde

Comptes e-mail + mot de passe synchronisés sur tous les appareils (Supabase), connexion mémorisée, copies automatiques et fichier de sauvegarde JSON : voir **`SAUVEGARDE.md`**.

## Comment sont faits les calculs

- **On saisit des journées**, n'importe quel jour de la semaine. Les **jours habituels** (choisis à la première ouverture, modifiables dans Réglages → Mon travail) servent à prévoir ; un jour saisi hors de ces jours devient un « jour en plus ». Le calendrier permet aussi de marquer un repos exceptionnel.
- **Ta part** = total encaissé × part gardée (50 % par défaut, réglable) + **pourboires** (gardés à 100 %). Elle est figée à la saisie : changer la part plus tard ne réécrit pas le passé.
- **Plusieurs objectifs** (mariage, ski…) : l'épargne est répartie **par date**, l'objectif le plus proche est rempli en premier, le reste va au suivant. Pour chacun, l'app dit combien mettre de côté par mois d'ici sa date et s'il sera atteint à ce rythme. Un objectif réalisé (« C'est fait ») sort de l'épargne. L'accueil affiche aussi l'**objectif du mois** (la part à gagner ce mois-ci pour tout tenir, et combien viser par jour restant) et le **récap de la semaine**.
- **Déjà de côté** : chaque mois terminé où tu as travaillé compte automatiquement : ta part du mois − dépenses perso − frais du salon (jamais en dessous de 0). Si tu fais le bilan d'un mois, c'est le montant réel du bilan qui compte. Le mois en cours apparaît dans l'estimation.
- **Vérification du mois** : au début de chaque mois, l'accueil demande en une question si tu as bien mis de côté le montant calculé (« Oui » ou « Un autre montant »). C'est facultatif : sans réponse, le calcul automatique compte.
- **Jours d'avant tes débuts** : l'app ne réclame jamais les jours antérieurs à ta première journée saisie. Les verdicts « dans les temps » n'apparaissent qu'à partir de 4 journées saisies.
- **Saisie rapide** : en ouvrant l'app après l'heure du rappel un jour de travail pas encore saisi, elle s'ouvre directement sur la saisie (une fois par jour).
- **Bilan du mois** (ancien fonctionnement, toujours accessible via « Corriger ») : il s'ouvre quand le dernier jour prévu du mois est saisi (ou quand le mois est fini). À épargner = ta part du mois − frais du salon − dépenses perso, jamais en dessous de 0. Les chiffres d'un bilan validé sont **figés** : modifier une journée ensuite ne change pas l'écart (l'app propose de mettre le bilan à jour).
- **Projection** : ton gain moyen par jour travaillé (moyenne des journées saisies sur les 60 derniers jours) est appliqué à **tous les jours prévus**, jusqu'à la fin du mois puis mois par mois jusqu'à la date de l'objectif. Les jours déjà saisis gardent leur vrai montant ; un jour prévu pas encore saisi compte pour le gain moyen (marque-le en repos dans le calendrier s'il ne compte pas). Chaque mois, on retire les dépenses perso et les frais du salon. Les mois terminés sont déjà dans « Déjà de côté ». L'accueil donne aussi **combien mettre de côté par mois** et **combien gagner par jour travaillé** pour atteindre l'objectif à temps.
- **Compliments** : à l'ouverture, l'app félicite pour un record (jour, semaine, mois), une hausse de tes gains, un bilan en avance ou un palier de l'objectif. Chacun ne s'affiche qu'une fois.
- **Stats** : vrais graphiques à axes gradués et unités (gains par mois ou par semaine, jours de la semaine, clients, épargne cumulée avec l'objectif), plus les comparaisons écrites en phrases.
- **Rappel de fin de journée** : bandeau sur l'accueil et pastille sur l'icône quand une journée prévue n'est pas saisie.
- Les anciennes données (par week-end) sont **converties automatiquement** en journées (samedi + dimanche).
- Tous les montants sont calculés en centimes, donc sans erreur d'arrondi.

## Sécurité des données

- Le service worker ne met en cache **que les fichiers de l'app**, jamais tes données ni les échanges avec le serveur.
- Si les données du téléphone deviennent illisibles, elles sont **mises de côté** (téléchargeables) au lieu d'être écrasées.
- Si un écran plante, un écran de secours permet de recharger l'app ou de télécharger ses données.
- La police est intégrée à l'app : aucune requête vers Google.
