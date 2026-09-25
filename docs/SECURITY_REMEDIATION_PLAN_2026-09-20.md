# Plan de remédiation et de vérification Flashover78 — 20 septembre 2026

Ce document organise la suite de l’audit de sécurité sur la branche locale
`codex/security-audit-2026-09-18`. Il ne constitue pas une autorisation de
déploiement. Les lectures distantes du 25 septembre 2026 ont confirmé la cible
Supabase/Cloudflare et l'état des migrations, Storage, fonctions, sauvegardes,
previews et headers ; la restriction Cloudflare Access des previews a été
activée. Aucune migration, donnée métier, email réel, rotation de secret ou
déploiement applicatif n'a été exécuté.

## Décisions métier intégrées

- Le calendrier est un outil de planning/reporting : les membres le consultent
  seulement ; les contributeurs et administrateurs peuvent créer, modifier et
  ajuster la capacité ; les coordonnées des participants restent réservées aux
  administrateurs.
- Les qualifications `RSFR`, `FOR INC` et `FOR BAT` sont attribuées ou retirées
  explicitement par un administrateur. Un profil nouvellement créé reste sans
  qualification tant qu’aucune case n’est cochée.
- `email_destinations` est une configuration opérationnelle. Les membres ne
  peuvent pas l’énumérer ; les Edge Functions la lisent avec leur client
  serveur et l’interface est réservée à l’administration AAL2.
- Les journaux et données médicales ne sont pas purgés automatiquement par
  l’application. Leur conservation dans les sauvegardes est volontaire ; la
  durée, le chiffrement, les destinataires et les tests de restauration doivent
  être confirmés auprès de l’opérateur et du DPO/RSSI.
- Les documents hors ligne restent disponibles au maximum 24 heures et sont
  liés au compte local. En production, les octets du document et l’index des
  métadonnées sont chiffrés AES-GCM avant stockage, avec une clé non exportable
  par compte dans IndexedDB ; `localStorage` ne conserve qu’une marque de
  propriétaire hachée. La déconnexion, le changement de compte, l’expiration
  ou une session révoquée détruisent la cache, les métadonnées et les clés.
  Une compromission XSS du même origin pourrait toutefois lire les données
  pendant que la session est active : ce mécanisme n’est pas une garantie
  absolue.

## État distant vérifié le 25 septembre 2026

- Le projet Supabase « Flashover78 » est lié au dépôt. L'historique distant
  s'arrête à `20260917172518`, qui correspond au SQL MFA/journal local ; les
  16 migrations de durcissement suivantes sont en attente. La policy distante
  de `email_destinations` autorise encore les membres authentifiés, ce que la
  migration locale corrige.
- Les sept buckets inventoriés sont privés ; neuf objets seulement sont
  comptés dans les buckets non vides, sans orphelin ni référence cassée dans
  l'inventaire sans noms. Les tables d'approbation de finalisation n'existent
  pas encore à distance.
- Quatre Edge Functions sont actives avec JWT vérifié ; `store-form-pdf`,
  `store-document` et `storage-cleanup-worker` sont absentes. Les secrets CORS,
  redirection et worker ne sont pas encore présents.
- WALG est actif mais PITR est désactivé et aucune sauvegarde n'est renvoyée
  par la CLI. Le déploiement DB reste bloqué jusqu'à la preuve d'un point de
  restauration restaurable.
- Cloudflare Pages est relié à GitHub, déploie `main` vers `dist` et sert le
  domaine de production. Les previews sont maintenant protégées par Access.
  La production observée avant livraison ne renvoyait pas CSP/HSTS/frame
  protection et autorisait CORS `*`; `_headers` doit donc être livré et vérifié.
- GitHub protège maintenant `main` (check `check` obligatoire, historique
  linéaire, pushes forcés/suppressions interdits et résolution obligatoire).
  Le workflow local est passé sur la PR ; il sera disponible sur `main` après
  fusion.

## Séquence d’exécution proposée

### 0. Gel et prérequis

1. Créer une branche de livraison dédiée depuis un état Git identifié et
   conserver les modifications locales existantes.
2. Désigner un responsable Supabase, un responsable hébergement/CI et un
   responsable sauvegardes. Aucun secret ne doit être copié dans les tickets,
   sorties de tests ou captures.
3. Exporter uniquement les métadonnées de configuration nécessaires (version
   de schéma, politiques, grants, fonctions et compteurs), sans données
   personnelles. Les comptes de validation sont synthétiques et séparés de la
   production.

### 1. Inventaire distant en lecture seule

Exécuter `supabase/operations/storage-inventory.sql` avec un rôle opérateur
autorisé. Conserver uniquement les compteurs : buckets publics/privés, limites,
objets orphelins, références cassées, anomalies de namespace/propriétaire et
objets historiques `.doc`/`.ppt`. Aucun nom d’objet ne doit être exporté dans
les fixtures.

Compléter l’inventaire par les résultats versionnés de :

- `pg_tables`, `pg_policies`, `information_schema.role_table_grants`, les
  signatures `SECURITY DEFINER`/`EXECUTE`, les contraintes `NOT VALID` et les
  interfaces Realtime/GraphQL exposées ;
- Auth : expiration JWT, rotation/révocation, facteurs TOTP vérifiés, AAL/AMR,
  journal Auth et pagination ;
- Edge Functions : version réellement déployée, variables présentes, origine
  CORS effective, quotas, journaux minimisés et absence de clé service dans les
  réponses ;
- Cloudflare/Pages : domaine, HTTPS/TLS, headers CSP/HSTS/frame/MIME/referrer,
  previews et cache ;
- GitHub : exécution du workflow de sécurité, protection de branche, environ-
  nements et secrets CI ;
- Brevo : limites, domaines/destinataires validés, alertes, coût et politique
  de rejeu ;
- sauvegardes : fréquence, chiffrement, rétention, restauration testée, RPO/RTO,
  quotas et alertes.

### 2. Répétition complète hors production

1. Recréer une instance Supabase locale complète avec toutes les migrations
   historiques. Le dépôt actuel ne permet pas de considérer les fixtures
   PGlite seules comme une preuve d’intégration complète.
2. Appliquer dans l’ordre les migrations locales, notamment :
   `20260919200000_document_contributor_publish.sql`,
   `20260920064930_remove_default_trainer_qualification.sql`,
   `20260920064931_restrict_email_destinations.sql` et
   `20260920065639_training_planning_member_view_only.sql`.
3. Rejouer les harnais Node/PGlite et les tests frontend. Tester deux
   propriétaires distincts, membre, contributeur, administrateur AAL1,
   administrateur AAL2/TOTP, facteur supprimé, session révoquée, profil
   désactivé, accès REST/RPC/Storage directs et deux écritures concurrentes.
4. Tester les parcours légitimes : consultation membre, modification du
   planning par contributeur, gestion complète par administrateur, attribution
   explicite puis retrait d’une qualification, administration AAL2 des
   destinataires et consultation hors ligne d’un document synthétique.

### 3. Fenêtre de déploiement à autoriser séparément

Dans cet ordre, après validation du plan de retour arrière :

1. Vérifier une sauvegarde exploitable et un point de restauration identifié.
   La cible actuelle renvoie une liste de sauvegardes vide ; tant qu'un
   opérateur n'a pas créé ou confirmé ce point, la migration distante doit
   rester bloquée. Une simple exportation de schéma ou un build réussi ne
   constitue pas un retour arrière des données.
2. Appliquer les migrations dans une fenêtre contrôlée, puis vérifier chaque
   contrainte, policy, grant et signature RPC.
3. Déployer les Edge Functions et le worker Storage avec leur version exacte,
   origine autorisée, secret serveur et scheduler. Utiliser une soumission
   synthétique ; ne pas envoyer d’email réel avant la vérification des
   destinataires.
4. Déployer le frontend et le Service Worker ; purger seulement les caches
   d’assets prévus, jamais la cache privée d’un autre compte par une commande
   globale.
5. Vérifier Cloudflare/Pages, previews, CORS runtime, headers et route réelle
   de chaque fonction. Un HTTP 200 ou un build valide ne suffit pas.
6. Réaliser une recette synthétique : connexion, AAL2, session révoquée,
   calendrier membre/contributeur, RLS à deux propriétaires, Storage signé,
   formulaire médical/PDF, rate limit, file de nettoyage et hors ligne.

### 4. Retour arrière

- Ne jamais désactiver RLS/MFA pour débloquer une livraison.
- Préparer des migrations compensatoires nouvelles ; ne pas réécrire l’historique
  déjà appliqué.
- Pour une migration de données, arrêter d’abord les écritures concernées,
  restaurer uniquement après approbation du responsable sauvegardes, puis
  vérifier profils, références métier, Storage, sessions et journaux séparément.
- Pour le worker, suspendre le scheduler et conserver les entrées de file ; ne
  supprimer un objet qu’après preuve de l’absence de toute référence.
- Pour le frontend/Service Worker, revenir à l’artefact précédent puis vérifier
  l’owner binding et la purge de session dans un navigateur réel.

## Critères d’acceptation et preuves attendues

La livraison ne sera considérée comme vérifiée que si chaque ligne possède une
preuve locale et une preuve distante datée :

| Domaine | Preuve requise |
| --- | --- |
| RLS/RPC | deux propriétaires, substitution d’identifiant refusée, grants et fonctions vérifiés sur l’instance cible |
| MFA/admin | AAL1 refusé, AAL2 + AMR TOTP accepté, facteur supprimé et session révoquée refusés |
| Planning | membre en lecture seule, contributeur/admin gestion du calendrier, coordonnées réservées admin |
| Qualifications | création sans case = `[]`, affectation à un événement seulement si la qualification existe |
| Destinataires | membre = zéro ligne, admin AAL2 = lecture, Edge Function = client serveur uniquement |
| Médical | propriété `auth.uid()`, fenêtre serveur, PDF généré côté serveur, transmission email séparément autorisée |
| Storage | buckets privés, URL signées courtes, limites MIME/taille/contenu, inventaire orphelins et quarantaine décidés |
| Email | quotas fournisseur/global, rejeu contrôlé, destinataires validés, alertes et coût observés |
| Hors ligne | octets et métadonnées chiffrés, clé supprimée à la déconnexion/changement de compte, TTL 24 h, revalidation en ligne |
| Exploitation | backup restauré sur environnement isolé, alertes testées, CI/headers/previews vérifiés |

## État et limites

Les corrections locales et leurs preuves sont détaillées dans
[`SECURITY_AUDIT_2026-09-18.md`](./SECURITY_AUDIT_2026-09-18.md). Les versions
OWASP ASVS 5.0.0 (mai 2025), WSTG 4.2 et API Security Top 10 2023 servent de
référentiels ; les versions Supabase/SDK/Cloudflare/Brevo effectivement
déployées doivent être relevées pendant l’inventaire.

Tant que la séquence distante n’est pas autorisée et exécutée, restent non
vérifiés : migration réelle, fonctions/worker réellement déployés, politiques
Storage, sauvegardes/restauration, limites fournisseur, exécution CI, headers
Cloudflare, previews, CORS runtime et concurrence PostgreSQL. Le maintien
fonctionnel hors ligne implique aussi qu’une révocation distante ne peut pas
annuler une consultation pendant la fenêtre hors connexion ; le TTL et le
chiffrement réduisent l’exposition sans supprimer ce compromis métier.
