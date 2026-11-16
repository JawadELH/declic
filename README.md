# Déclic 🌿

**Le réseau social bienveillant pour se libérer de ses mauvaises habitudes.**

Tabac, alcool, sucre, réseaux sociaux, jeux d'argent, ongles rongés… ou n'importe quelle habitude que tu définis toi-même. Déclic combine un suivi personnel (tableau de bord, paliers, analyses), une communauté d'entraide et des notifications intelligentes qui interviennent au bon moment, sans jamais devenir envahissantes.

> Le tabac sert d'exemple complet (repères santé de l'OMS, déclencheurs typiques, astuces), mais tout le système est générique : une habitude = une entrée dans `shared/habits.js`.

---

## L'essentiel en 10 secondes

- **Aujourd'hui** : un anneau qui se remplit jusqu'au prochain cap, ce que tu as gardé (argent, unités, victoires) et **un seul gros bouton : « J'ai une envie »**.
- **J'ai une envie** : le minuteur de respiration démarre tout seul (90 s), un tap pour dire ce qui l'a déclenchée, et **« Prévenir le groupe »** pour recevoir de la force **en direct** pendant la respiration.
- **Victoire** : écran plein, vibration, compteur de victoires, argent gagné tout de suite.
- **Groupe en direct** : membres en ligne, compteur collectif du jour, SOS avec compte à rebours, défi du jour, fil d'événements automatiques (envies battues, caps atteints) et « Bravo » en un tap.
- **Progrès** : projection à 1 mois et 1 an, semaine vs semaine, calendrier des 8 dernières semaines, réussite par moment de la journée, moments à risque, déclencheurs, caps.
- **Alliés** : invitation par lien (alliance immédiate grâce à un code secret), recherche par pseudo, demandes à accepter. Les SOS des alliés passent en premier.
- **Cercles** : groupes privés de 12 alliés maximum, avec classement des séries et discussion.
- **Blocage** : une personne bloquée disparaît de ton fil et ne peut plus te demander en alliance.
- **Administration** : l'adresse `jawad.elhamdani.pro@gmail.com` (e-mail vérifié, par exemple via la connexion Google) accède à l'espace **Moi → Administration** : chiffres clés, signalements, membres, suspension, nomination de modérateurs. L'adresse est inscrite dans `shared/roles.js` et `firestore.rules`.

Tout cela fonctionne avec la **formule gratuite Firebase (Spark)**. La formule Blaze ajoute les rappels push planifiés (Cloud Functions).

### Mettre à jour en ligne (formule gratuite)
```bash
git pull
npm install
npm run deploy:gratuit
```

---

## Nouveautés v1.2

- **Bilan sur l’écran d’accueil** : envies battues et consommations du jour et depuis le début, argent gardé qui défile en direct. Touche le bilan pour ouvrir l’**historique** jour par jour (suppression d’une entrée saisie par erreur).
- **Récompenses** : tirelire (objectif concret à s’offrir), arbre qui grandit à chaque envie battue, carte surprise après chaque victoire (avec une collection rare), bilan de la semaine, bravos reçus du groupe.
- **Rappels dans l’app** avant tes moments délicats (fonctionne avec la formule gratuite Spark).
- **Réinitialisation** : « Recommencer cette habitude » (dans Moi › Mes habitudes) ou « Tout réinitialiser » (Moi › Mes données).
- **Mode développeur** : visible d’office pour le compte admin, et pour tout le monde après 7 appuis rapides sur le numéro de version en bas de Moi. Il permet de générer 7, 30 ou 90 jours d’historique de démo, de reculer la date de départ, de prévisualiser les écrans de victoire et de célébration, puis de tout nettoyer. Les données de démo ne sont jamais publiées dans le groupe.
- **Hors ligne** : l’application s’ouvre sans réseau une fois visitée ; les saisies sont synchronisées au retour de la connexion.

## Fonctionnalités détaillées

### Suivi personnel
- **Deux objectifs** : arrêt complet (série en cours, record, paliers) ou réduction progressive (objectif quotidien, jours d'affilée dans l'objectif).
- **« J'ai une envie »** : intensité, déclencheur, astuce adaptée, rappel de *ton pourquoi*, exercice de respiration de 2 minutes, bouton « Demander du soutien » qui publie un appel à la communauté.
- **« J'ai craqué »** sans jugement : la série repart, mais les économies et les envies surmontées restent acquises.
- **Hors ligne** : le cache Firestore permet de noter une envie sans réseau.

### Tableau de bord
- Compteur en direct, économies, unités en moins, taux d'envies surmontées.
- Prochain palier avec barre de progression (repères santé pour le tabac, paliers génériques sinon) et partage en un clic.
- Graphiques : envies sur 30 jours (surmontées / non surmontées, vue tableau incluse), économies cumulées, **carte de chaleur jour × heure** des moments à risque, déclencheurs avec taux de réussite.
- **Analyses automatiques** : « Tes envies se concentrent entre 13 h et 15 h », « −35 % d'envies cette semaine », « Tu résistes 80 % du temps face au stress mais 40 % face à l'alcool »…

### Communauté
- Fil de messages (message, victoire, besoin de soutien), filtrable par habitude.
- Réactions (💪 Courage, 👏 Bravo, 🙏 Merci) et commentaires.
- Pseudonymes et avatars emoji pour la discrétion ; signalement et suppression.

### Notifications intelligentes, non intrusives
- Profil de risque appris de *tes* envies : le rappel arrive ~15 min **avant** ton moment difficile.
- Budget strict (1 ou 2 par jour), heures calmes, pas de notif si tu es déjà dans l'app.
- **Auto-régulation** : si tu ignores les rappels, le moteur devient plus sélectif, puis se met en pause.
- Permission push demandée uniquement sur clic ; tout reste aussi disponible dans l'app.
- Détails : [docs/notifications-intelligentes.md](docs/notifications-intelligentes.md).

### Vie privée
- Données personnelles lisibles uniquement par leur propriétaire (règles Firestore).
- Export JSON et suppression complète du compte depuis les réglages.

---

## Architecture

```
├── shared/                  Moteur pur, partagé client + serveur (testé)
│   ├── habits.js            Catalogue générique des habitudes (tabac, alcool, sucre…)
│   ├── stats.js             Série, économies, paliers, séries quotidiennes, analyses
│   ├── risk.js              Profil de risque 7 j × 24 h
│   ├── nudges.js            Planification et règles des notifications
│   └── time.js              Fuseaux horaires, durées
├── src/                     Front React (Vite) — PWA installable
│   ├── pages/               Connexion, Onboarding, Tableau de bord, Communauté, Notifications, Réglages
│   ├── components/          Graphiques, feuilles « envie / écart », respiration, posts…
│   ├── hooks/useAppData.jsx Abonnements temps réel Firestore
│   └── lib/                 Accès Firestore, FCM, formatage
├── functions/               Cloud Functions (Node 22, 2e génération)
│   ├── index.js             Triggers, planificateur (15 min), fonctions appelables
│   └── src/                 Orchestration du moteur, fonctions sociales
├── public/                  Service worker FCM, manifeste PWA, icônes
├── tests/                   Tests Vitest du moteur
├── firestore.rules          Règles de sécurité
├── firestore.indexes.json   Index composites
└── .github/workflows/       CI (tests + build) et déploiement
```

### Modèle de données Firestore

| Chemin | Contenu | Accès |
|---|---|---|
| `users/{uid}` | préférences de notif, fuseau, jetons FCM, dernière activité | propriétaire |
| `users/{uid}/habits/{id}` | modèle, mode, référence/jour, coût, date de départ, motivation | propriétaire |
| `users/{uid}/logs/{id}` | `craving` (intensité, déclencheur, surmontée) ou `use` (quantité) | propriétaire, création seule |
| `users/{uid}/notifications/{id}` | historique des notifications (lu / ouvert) | propriétaire |
| `engine/{uid}` | profil de risque, état du moteur, prochain rappel | lecture propriétaire, écriture serveur |
| `profiles/{uid}` | pseudo, avatar | lecture membres connectés |
| `posts/{id}` (+ `reactions`, `comments`) | fil communautaire | membres connectés |
| `reports/{id}` | signalements | création seule |

---

## Démarrage

### 1. Prérequis
- Node.js 22+
- Firebase CLI : `npm install -g firebase-tools` puis `firebase login`
- Un projet Firebase en **formule Blaze** (requise pour les Cloud Functions planifiées ; l'usage d'une petite communauté reste en général dans les quotas gratuits).

### 2. Configurer Firebase
Dans la [console Firebase](https://console.firebase.google.com) :
1. **Authentication** → activer *Email/Mot de passe* et *Google*.
2. **Firestore Database** → créer la base (région `europe-west1` conseillée).
3. **Paramètres du projet → Vos applications** → ajouter une application Web et copier la configuration.
4. **Paramètres du projet → Cloud Messaging → Certificats Web push** → générer une paire de clés (VAPID).

### 3. Installer
```bash
git clone https://github.com/<ton-compte>/declic.git
cd declic
npm install
npm --prefix functions install
cp .env.example .env.local     # puis remplis les valeurs
```
Remplace `ton-projet-firebase` par l'identifiant de ton projet dans `.firebaserc` (ou lance `firebase use --add`).

### 4. Lancer en local
```bash
npm run dev            # front sur http://localhost:5173 branché sur ton projet Firebase
```
Ou entièrement en local avec les émulateurs (mets `VITE_USE_EMULATORS=true` dans `.env.local`) :
```bash
npm run emulators      # Auth, Firestore, Functions + interface sur http://localhost:4000
npm run dev            # dans un second terminal
```

### 5. Tester
```bash
npm test               # moteur : stats, profil de risque, règles de notification
npm --prefix functions run check
```

### 6. Déployer
```bash
npm run deploy         # build + règles + index + fonctions + hébergement
```
L'app est alors en ligne sur `https://<projet>.web.app`. Si tu utilises un autre domaine, définis `APP_URL` pour les fonctions (fichier `functions/.env`) afin que les liens des notifications pointent au bon endroit.

---

## Publier sur GitHub

Le dossier est déjà un dépôt Git avec un premier commit :
```bash
# crée un dépôt vide « declic » sur github.com, puis :
git remote add origin https://github.com/<ton-compte>/declic.git
git push -u origin main
```

### Déploiement automatique (facultatif)
Le workflow `.github/workflows/deploy.yml` déploie à chaque push sur `main`. Pour l'activer :
1. Crée un compte de service dans Google Cloud (rôles *Firebase Admin* et *Cloud Functions Admin*, *Service Account User*) et télécharge sa clé JSON.
2. Dans GitHub → *Settings → Secrets and variables → Actions*, ajoute les secrets `FIREBASE_SERVICE_ACCOUNT` (contenu du JSON), `FIREBASE_PROJECT_ID` et les `VITE_FIREBASE_*` de ton `.env.local`.
3. Dans l'onglet *Variables*, crée `ENABLE_DEPLOY` = `true`.

Le workflow `ci.yml` lance les tests et le build sur chaque pull request, sans aucun secret.

---

## Ajouter une habitude

Ajoute une entrée dans `HABIT_TEMPLATES` (`shared/habits.js`) :

```js
cafe: {
  id: 'cafe',
  cravingPhrase: 'l’envie d’un café',
  label: 'Café',
  emoji: '☕',
  unit: 'tasse',
  unitPlural: 'tasses',
  defaultPerDay: 4,
  defaultCostPerUnit: 1.2,
  triggers: ['Réveil', 'Pause', 'Fatigue', 'Après repas'],
  tips: ['Remplace par une tisane ou un grand verre d’eau.'],
  // milestones: [...]  // facultatif : sinon paliers génériques (24 h, 3 j, 1 sem…)
},
```
Onboarding, tableau de bord, communauté et notifications s'adaptent automatiquement. Les utilisateurs peuvent aussi créer une habitude personnalisée depuis l'app.

---

## Notes

- **iPhone** : les notifications web push nécessitent d'ajouter l'app à l'écran d'accueil (iOS 16.4+).
- **Contenu santé** : les repères affichés sont indicatifs et ne remplacent pas un avis médical. Pour l'alcool, l'app avertit qu'un arrêt brutal peut être dangereux en cas de forte dépendance. Les numéros d'aide (Tabac Info Service 39 89, Alcool Info Service, Joueurs Info Service) sont affichés pour les habitudes concernées.
- **Modération** : les signalements arrivent dans la collection `reports`, à traiter depuis la console Firebase (ou avec un petit outil d'admin à construire).

## Licence

MIT
