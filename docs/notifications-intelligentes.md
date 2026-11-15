# Notifications intelligentes et non intrusives

Le moteur vit dans `shared/nudges.js` et `shared/risk.js` : du JavaScript pur, sans dépendance, testé dans `tests/engine.test.js` et utilisé à la fois par l'app (pour afficher « prochain rappel prévu ») et par les Cloud Functions (pour décider et envoyer).

## Le cycle

```
L'utilisateur note une envie ─► onLogCreated ─► replan()
                                                 │  1. profil de risque (7 j × 24 h)
                                                 │  2. prochain palier à fêter
                                                 │  3. planNextNudge() → engine/{uid}.nextNudgeAt
                                                 ▼
Toutes les 15 min : dispatchNudges ─► engine où nextNudgeAt ≤ maintenant
                                        │  computeIgnoredStreak() → pause éventuelle
                                        │  canSendNow() → OK / reporté (raison)
                                        │  composeNudge() → push FCM + historique in-app
                                        └► replan()
```

Le planificateur n'interroge que les utilisateurs qui ont une notification due (`nextNudgeAt ≤ now`), donc le coût ne dépend pas du nombre total d'inscrits.

## Le profil de risque

Chaque envie notée enregistre son heure et son jour locaux. Le moteur construit une matrice de 168 cases (7 jours × 24 heures) :

- **décroissance exponentielle** (demi-vie 14 jours) : les habitudes récentes pèsent plus que celles d'il y a deux mois ;
- **pondération** par l'intensité, et ×1,5 quand l'envie n'a pas été surmontée ;
- **lissage** sur les heures voisines et sur la même heure des autres jours (une envie le lundi à 13 h rend 13 h un peu plus risqué les autres jours aussi) ;
- **normalisation** entre 0 et 1 (1 = ton pire moment).

Sous 5 envies notées, aucune prédiction n'est faite : pas de notification « au hasard ».

## Les garde-fous

| Règle | Discret (défaut) | Équilibré |
|---|---|---|
| Rappels « moment à risque » par jour | 1 max | 2 max |
| Écart minimal entre deux rappels | 18 h | 5 h |
| Seuil de risque pour déclencher | ≥ 70 % du pic | ≥ 50 % du pic |

Et dans tous les cas :

- **Heures calmes** (22 h → 8 h par défaut, réglables) : jamais de notification, même pour un palier.
- **Anticipation** : le rappel part ~15 minutes *avant* le moment à risque, le meilleur créneau de la journée seulement.
- **Déjà dans l'app** (activité < 45 min) : pas de rappel, ce serait redondant.
- **Auto-régulation** : une notification non ouverte ni lue sous 12 h compte comme ignorée. À partir de 2 ignorées, le seuil monte (+10 points par notification ignorée) ; à 3, pause de 2 jours ; 4 → 4 jours ; puis 6-7 jours. Une seule notification ouverte remet tout à zéro.
- **Push optionnel** : la permission n'est demandée qu'au clic sur « Activer ». Sans push, tout reste visible dans le centre de notifications de l'app.
- **Social** : les réponses de la communauté arrivent dans l'app ; en push seulement si l'utilisateur l'a demandé, et au plus une fois toutes les 2 heures.
- **Expiration** : un rappel non délivré sous 2 h (téléphone éteint) est abandonné (TTL web push).
- **Transparence** : l'écran Notifications explique le mode actif, la pause éventuelle et le prochain rappel prévu, avec sa raison.

## Le ton

Les messages ne culpabilisent jamais : ils nomment le moment (« Vers 13 h, l'envie de fumer se manifeste souvent (souvent : après repas) »), proposent une astuce concrète tirée du modèle d'habitude, et varient pour ne pas devenir du bruit. Un écart n'est jamais présenté comme un échec : le total économisé et les envies surmontées restent acquis.

## Ajuster

Tout se règle dans `shared/nudges.js` (`NOTIF_LEVELS`, `LEAD`, `ACTIVE_WINDOW`, `pauseDuration`) et `shared/risk.js` (`MIN_SAMPLES`, demi-vie). Lance `npm test` après chaque modification.
