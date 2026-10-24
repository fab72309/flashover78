# Flashover78 — audit et fiabilisation du 24 octobre 2026

> Instantané de fin d'audit avant publication. Pour les migrations et fonctions
> réellement publiées ensuite, voir [la note 0.19.1-alpha](RELEASE_0.19.1-alpha.md).

## Résultat réel

Sept défauts confirmés ont des corrections locales : suppression en cascade de
données à conserver, bypass d'authentification de développement activable dans
un build, expiration hors ligne perdue en concurrence, documents ODT actifs
acceptés, allocation du corps Edge avant sa borne, quotas trop restrictifs et
écran documentaire inutilisable hors réseau malgré un cache valide.

Aucune correction de cette exécution n'est publiée. Les lectures Supabase
confirment encore les cascades de suppression ; les sources Edge publiées
admin-users et store-document ne contiennent pas les nouveaux gardes. La
sécurité des parcours authentifiés en production et la restauration des
données ne sont pas démontrées. L'absence de sauvegarde exploitable démontrée
reste un risque majeur.

Livrables : carte/matrice dans `SECURITY_MAP_2026-10-24.md`, preuves distantes
datées dans `security-evidence/2026-10-24/`, deux migrations additives, correctifs
frontend/Edge, tests et extension de la CI. Les sections suivantes distinguent
documentation, code, tests locaux, lectures distantes et publication.
La revue indépendante est archivée dans `SECURITY_REVIEW_2026-10-24.md`.

## Phase 0 — fiche de décision et état initial

- Objectif : corriger les vulnérabilités présentes en conservant planning en
  reporting, qualifications explicites distinctes, données médicales/journaux,
  administration AAL2 et documents hors ligne chiffrés liés au compte <24h.
- Complexité/risque/volume/dépendances/fraîcheur : 3/3/3/3/3 ; besoin de plusieurs
  disciplines, lectures distantes et validation indépendante.
- Autorisé : modifications locales réversibles, tests synthétiques, lectures
  distantes de métadonnées/configuration. Non autorisé : push, fusion, déploiement,
  migration distante, secrets/DNS/infrastructure, suppression, compte réel,
  email réel, upgrade ou test actif de production. Aucune de ces actions faite.
- Instructions : consignes globales fournies et quatre documents imposés lus
  intégralement avant modification ; aucun AGENTS.md supplémentaire trouvé dans
  le dépôt ou les parents applicables examinés.
- Branche initiale : `codex/brulage-maf-document-sections`, HEAD `13faefd`.
  Sept fichiers étaient déjà modifiés : roadmap, audit du 18 septembre,
  remediation du 20 septembre, admin-mfa, security-input-audit, cors.ts et
  migration active_session_rls. Leurs octets sont inchangés par cette exécution
  (empreintes initiales et finales comparées). Ni reset ni réécriture historique.
  La modification nouvelle de MEDICAL_FOLLOWUP est distincte de ces sept fichiers.
- Outillage : macOS, Node 25.2.1, npm 11.6.2, Supabase CLI 2.72.7, Deno 2.9.7,
  gh authentifié. Docker/psql/wrangler exécutables non identifiés ; aucune
  instance Supabase complète locale disponible. CLI ancienne : introspection
  SQL et advisors via MCP officiel, aucune commande SQL inventée.
- Dépendances locales initiales différentes du lock : npm ls signale des
  invalid/extraneous ; validation refaite dans `/tmp/flashover78-security-validation`
  par npm ci, sans remplacer node_modules du dépôt ni modifier le lockfile.
  PGlite 0.5.8 installé séparément dans `/tmp/flashover-mfa-db-test`.
- Backup : la documentation signale l'absence de sauvegarde ; l'organisation
  Supabase a été relue en offre free. Aucun inventaire de sauvegardes exploitable,
  export séparé des objets Storage ou test de restauration obtenu. Ni RPO ni
  RTO convenus/démontrés. L'acceptation explicite de ce risque reste à décider.
- État réel : Supabase ACTIVE_HEALTHY, PostgreSQL 17.6 ; sept Edge actives avec
  JWT exigé ; Cloudflare répond mais son plan de contrôle n'est pas accessible
  par les outils utilisés. L'HTML retourné sur version.json ne donne aucune
  identité fiable de release. Aucun ancien état distant n'est repris comme preuve.

### Équipe et frontières

Capacité : quatre agents au total, coordinateur inclus ; profondeur un,
sous-délégation interdite. Modèle/effort hérités, aucun override. Agents ayant
les permissions du parent : lecture seule imposée par contrat, pas isolation
technique prétendue. Lots initiaux DB, Edge/entrées et frontend ; relecteur
indépendant après libération du lot DB. Coordinateur seul écrit les migrations,
les décisions d'autorisation et la documentation finale. Les chemins des deux
correcteurs étaient exclusifs et les changements intégrés séquentiellement.
Le relecteur a reproduit deux oublis : préfixe XML Unicode et blob déjà affiché
après changement de compte ; les deux ont été corrigés puis retestés.

## Constats confirmés et correctifs locaux

### F78-01 — Élevée — confirmé : destruction par suppression de compte

- Source : schéma initial profiles.id→auth.users CASCADE, migrations médical
  `20260912120648:3`, main courante `20260912183803:3`, réparation
  `20260914044322:3` ; action delete de `supabase/functions/admin-users/index.ts`.
- Scénario : administrateur AAL2 supprime un compte possédant des fiches mais
  sans version documentaire empêchant déjà sa suppression. La cascade efface
  médical/main/réparation ; la suppression des formulaires peut aussi planifier
  la purge de leurs PDF. Les journaux gardent leurs lignes mais perdent actor_id
  par SET NULL.
- Impact : perte des données à conserver, sans restauration démontrée.
- Preuve : FK distantes dans retention.json ; reproduction synthétique avec
  le vrai CREATE TABLE médical initial : une suppression Auth fait passer le
  nombre de fiches de un à zéro ; retained-records-check reproduit aussi la
  cascade sur fixture avant correction.
- Correction : migration `20261024162125_security_preserve_retained_records.sql`,
  six FK ON DELETE RESTRICT transactionnelles (trois propriétaires, trois
  acteurs de journaux). Le handler refuse 409 avant suppression si ces liens
  existent et 503 si leur contrôle échoue. Les FK ferment la course après ce
  précontrôle. Aucun effacement ni anonymisation ; un compte inutilisé reste
  supprimable. La désactivation de compte reste un parcours à concevoir.
- Non-régression : retained-records-check + admin-api-check, suppression
  Auth/profil refusée et lignes/acteur conservés, compte inutilisé positif,
  erreurs de contrôle fermées, migration rejouée deux fois.
- Distant : cascade encore présente ; migration puis admin-users exigent une
  autorisation distincte. Ce patch ne récupère aucune donnée déjà perdue.

### F78-02 — Élevée — confirmé : bypass de développement dans un build

- Source : ancienne `src/utils/devAuth.ts:7-14` ; nouveau contrôle lignes 3–6.
- Scénario/préconditions : build `vite build --mode test` servi sur le domaine
  réel ; MODE=test activait le bypass sans flag et avec DEV=false. Un flag vrai
  dans un build production sur localhost l'activait également.
- Impact : simulation d'identité/parcours métier et confusion opérationnelle.
  Aucun JWT privilégié ni contournement des RLS serveur n'est démontré.
- Preuve : transpilation de la source réelle avec ces valeurs renvoie true
  avant correction, false après. Tests devAuth couvrent les combinaisons.
- Correction : DEV vrai ET PROD faux ET flag explicitement vrai ; vite.config
  force aussi ce flag à false pour toute commande build. Les constantes DEV/PROD
  suivent NODE_ENV, pas la commande Vite : NODE_ENV=development + flag vrai
  permettait encore un bundle avec bypass sans ce second garde. Fixture
  training isolée par mock explicite réservé au test.
- Non-régression : devAuth.test.ts, test preview training, check global/build ;
  build-auth-bypass-check construit réellement le module avec NODE_ENV=development,
  flag vrai et mode test, puis l'exécute. Sans le garde Vite : true (échec du
  nouveau test) ; après correctif : false. Aucun artefact publié.
- Distant : publication frontend nécessaire ; aucune preuve que le build
  actuellement servi utilise le mode vulnérable, aucun déploiement effectué.

### F78-03 — Élevée — confirmé : cache restituable au-delà de 24 heures

- Source : ancien read-modify-write global des échéances dans
  `src/utils/offlineDocuments.ts:333-341` et absence de TTL individuel dans
  `src/services/supabaseService.ts:getCachedDocumentUrl`.
- Scénario : deux sélections simultanées A/B lisent puis réécrivent le même
  dictionnaire ; l'échéance A disparaît alors que ses octets chiffrés restent.
  La purge ne connaît plus A et sa restitution n'exigeait pas de date propre.
- Impact : dépassement de la durée prévue, sous le même compte/session locale.
- Preuve : Promise.all de deux écritures dans l'utility réelle transpilée avec
  IndexedDB simulée produit seulement l'échéance B avant correction.
- Correction : une échéance chiffrée par couple compte/document, sélection
  atomique de clé, IndexedDB v3 ; refus d'une date absente/invalide/future ou
  âgée de 24h, avant et après déchiffrement. Compte/session revérifiés après
  les awaits ; getUser + require_active_session restent exigés en ligne.
- Non-régression : offlineDocuments.test.ts, concurrence synthétique, âge exact,
  date absente/future, erreur IDB, compte changé pendant lecture et expiration
  pendant déchiffrement. AES-GCM/WebCrypto exécuté, transports/Cache/IDB simulés.
- Distant : frontend non publié. Le changement de génération du marqueur
  propriétaire invalide les anciennes copies/clés locales : nouvelle sélection
  des documents nécessaire, aucune donnée serveur supprimée. Un navigateur
  fermé ne purge pas physiquement à heure fixe ; l'accès est refusé dès 24h.
  Une révocation distante demeure inconnaissable durant une vraie coupure.

### F78-04 — Élevée — confirmé : contenu actif/externe ODT non filtré

- Source : `supabase/functions/_shared/documentSignature.ts`, inspection des
  seuls .rels avant correction ; content.xml ODT échappait à cette inspection.
- Scénario : contributeur fournit un ODT avec office:scripts ou href externe.
  Le filtre acceptait ces octets avant publication. Exécution effective dans
  un lecteur bureautique non testée, pas d'exploitation distante revendiquée.
- Impact : distribution de fichiers dont l'activité contredit le filtre annoncé.
- Preuve : ZIP synthétique fflate + vrai handler/validator accepte avant
  correction ; store-document-check refuse après, avant tout upload simulé.
- Correction : XML ODT inspectés, scripts/listeners/objets/plugins/liens externes,
  traversal, DTD/entités, xml:base et encodages non pris en charge refusés.
  Préfixes Unicode et entités numériques couverts après contestation du relecteur.
- Non-régression : contenus actifs ASCII/Unicode/encodés refusés, ODT passif
  avec image interne et texte accentué accepté ; tests PDF et OOXML conservés.
- Distant : source store-document v2 relue, ancien filtre encore publié.
  Déploiement autorisé séparément requis ; historiques non inspectés. Le filtre
  structurel reste sans parseur ODF complet, quarantaine ou antivirus.

### F78-05 — Moyenne — confirmé : borne de corps après allocation mémoire

- Source : six handlers admin/3 emails/2 finaliseurs lisaient request.text()
  avant la vérification de taille ; JSON null/primitif pouvait aussi donner 500.
- Scénario : appelant authentifié transmet un corps surdimensionné sans
  Content-Length fiable ; toute la charge est allouée avant refus.
- Impact : consommation mémoire inutile et erreurs techniques sur entrées invalides.
- Correction : `_shared/requestBody.ts`, lecture stream bornée en octets,
  annulation au premier dépassement, UTF-8 strict et objet JSON obligatoire.
  Les limites propres à chaque handler sont conservées.
- Preuve/non-régression : request-body-check, Content-Length absent/mensonger,
  flux arrêté au chunk débordant, limite exacte, UTF-8 fragmenté/invalide,
  JSON null/tableau/primitif refusé ; harnais des six handlers repassés.
- Distant : six Edge non redéployées ; sources admin/store relues sans helper.
  Ce correctif ne borne ni le débit ni la durée d'un flux lent ; le worker
  interne, protégé par secret, conserve son parseur distinct.

### F78-06 — Faible — confirmé : quotas finaux de 199/49 au lieu de 200/50

- Source : register_document_upload_approval et register_form_pdf_approval,
  migrations `20260919180000:149` et `20260919170000:206`.
- Scénario : le dernier objet autorisé est déjà compté après upload ; >=200/50
  refuse l'approbation de l'objet de frontière, contrairement au commentaire.
- Impact : refus d'usage légitime et nettoyage d'orphelins inutile.
- Correction : `20261024162243_security_upload_quota_boundaries.sql`, >200/50 ;
  budget 100 MiB, validation objet, verrou utilisateur, session/serveur et
  triggers legacy conservés. EXECUTE reste réservé à service_role.
- Preuve/non-régression : vrais SQL sur fixtures PGlite, 200/50 acceptés,
  201/51 refusés, replay deux fois, EXECUTE authenticated refusé ; les anciens
  tests affirmaient la mauvaise frontière et ont été corrigés.
- Distant : définitions anciennes relues dans functions.json ; migration non
  appliquée. Concurrence Storage réelle non prouvée par ces fixtures.

### F78-07 — Moyenne — confirmé : détail documentaire bloqué hors réseau

- Source : `src/pages/DocumentDetail.tsx:prepareUrls/loadDocument` et fallback
  `getDocumentById/searchDocuments` de supabaseService.
- Scénario : document sélectionné/chiffré/valide présent, mais l'écran attend
  listDocumentVersions et createSignedUrl, indisponibles pendant une coupure.
  Autre scénario : blob A déjà affiché puis passage à B absent/en erreur ; les
  anciennes URLs n'étaient pas remises à zéro.
- Impact : fonction hors ligne indisponible et blob ancien encore vivant.
- Correction : métadonnées locales compte/session/TTL sans RPC hors réseau,
  blob pour ouverture/téléchargement, historique différé, erreur explicite si
  cache absent/expiré ; URLs/document effacés dès nouveau chargement, anciennes
  générations ignorées et blobs révoqués.
- Preuve/non-régression : DocumentDetail.offline.test.tsx et tests service,
  aucun appel réseau simulé, propriétaire différent, blob déjà affiché puis B
  absent/en erreur et lecture retardée après changement de compte.
- Distant : publication frontend nécessaire ; tests DOM/network simulés,
  aucune coupure physique ni PWA native testée.

## Tableau problème → correction → preuve → local → distant

| ID | Correction | Preuve reproductible | État local | État distant |
| --- | --- | --- | --- | --- |
| F78-01 | RESTRICT + garde Edge | retained-records/admin-api | code + tests synthétiques | FK CASCADE et Edge ancien relus ; non appliqué |
| F78-02 | DEV && !PROD && flag | devAuth/training/check | code + tests/build | mode du build servi inconnu ; non publié |
| F78-03 | échéance chiffrée individuelle + recontrôles | offlineDocuments | code + crypto/tests simulés | navigateur non vérifié ; non publié |
| F78-04 | refus ODT actifs/externes/Unicode | store-document | code + handler simulé | ancien validator relu ; non déployé |
| F78-05 | lecture JSON bornée | request-body + handlers | code + flux/transport simulés | admin/store sans helper ; non déployé |
| F78-06 | bornes inclusives + ACL serveur | storage-lifecycle/document-finalization | SQL PGlite + replay | anciennes fonctions relues ; non appliqué |
| F78-07 | parcours offline sans RPC + révocation blobs | UI détail + service | code + DOM/transports simulés | non publié ; pas recette PWA |

## Vérifications locales et qualité de preuve

L'état initial a réussi npm run check (26 fichiers, 103 tests) malgré les
défauts décrits : ces succès ne suffisaient pas. Des tests couvrant les scénarios
manquants ont été ajoutés. Une installation isolée npm ci conforme au lock a
ensuite servi aux validations finales. Le relevé final exact des compteurs et
versions figure dans `security-evidence/2026-10-24/local-validation.json`.

Commandes reproductibles (Node compatible avec engines, dépendances du lock) :

```sh
npm ci
npm run check
npm audit --omit=dev
npm audit
npm install --prefix /tmp/flashover-mfa-db-test --no-audit --no-fund @electric-sql/pglite@0.5.8
PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test --test-concurrency=2 supabase/tests/*-check.mjs
git diff --check
```

Les tests incluent membre/contributeur/admin AAL1/AAL2, AMR absent/téléphone,
TOTP absent/non vérifié/supprimé, session révoquée, qualifications sans défaut,
email_destinations, planning membre lecture seule, deux propriétaires médicaux,
modification de propriétaire et avant/à/après 72h, quotas/approbations, entrées
et fichiers actifs, logout/changement de compte et réseau simulé hors ligne.
Le workflow CI inclut les nouveaux harnais médical/rétention/corps/build Vite.

Limites : PGlite exécute du SQL PostgreSQL sur fixtures minimales et extraits
identifiés des migrations, sans pile Supabase complète. Edge/Brevo/Auth et
Cache/IndexedDB sont simulés dans les tests correspondants. Les contrôles de
verrouillage ne prouvent pas la concurrence PostgreSQL réelle. Aucun E2E direct
REST/RPC/Storage avec deux comptes de test distants n'a été lancé. Aucun email.

Audit dépendances : zéro avis pour les dépendances de production dans
l'installation propre. Trois avis modérés de développement concernent la chaîne
Tailwind/postcss-selector-parser. L'avis officiel précise que le parsing de CSS
de confiance au build n'est pas exposé comme un service traitant des sélecteurs
hostiles : aucun tel chemin runtime identifié ici. Pas de mise à jour majeure
aveugle ni npm audit fix --force. Le scan ciblé de dist est limité aux signatures
de secrets indiquées dans la cartographie ; aucune absence absolue garantie.

## Lectures distantes du 24 octobre 2026

Les JSON de preuve contiennent date, requête SQL et réponse de métadonnées.
Source MCP Supabase, CLI migration/functions/secrets, gh api et HEAD HTTP
ordinaire ; aucune sonde hostile, preflight provoqué ou appel métier distant.

| Surface | Fait vérifié à distance | Limite |
| --- | --- | --- |
| Supabase projet | Flashover78 lié, ACTIVE_HEALTHY, PostgreSQL 17.6, offre free | santé technique seulement |
| Migrations | historique relu ; versions septembre présentes ; sections brûlage local 20261024151739 / distant 20261024151827 | même nom, équivalence de contenu non établie ; aucun repair/push |
| RLS/grants/fonctions | toutes tables publiques observées RLS ; policies médical P + session, calendrier membre lecture, email_destinations admin ; helpers MFA/session et grants relus | pas exécution comme comptes Auth réels ; setting exposition schémas non concluant |
| Admin MFA | rôle actuel + has_active_session + aal2 + AMR totp + facteur verified dans définitions | réglages Auth/facteur réel et navigateur non testés ; has_admin_mfa seul n'est pas un rôle |
| Edge | 7 ACTIVE, verify_jwt=true ; versions 9/8/5/5/1/2/1 selon remote-summary | sources relues seulement admin-users/store-document ; aucune recette HTTP authentifiée |
| Secrets | noms CORS/redirection/Brevo/worker/Supabase présents | aucune valeur lue ; exactitude/rotation inconnues |
| Storage | 7 buckets privés, 29 objets brûlage et 2 mains courantes, autres zéro | contenu/historique/AV et consommations fournisseur non inspectés |
| Auth audits | 81 événements, dernier horodatage 24/10 15:43:02 UTC | aucun payload/IP lu ; présence ne prouve pas le réglage ni la rétention |
| Worker | file de 2 lignes ; extension pg_cron absente | scheduler externe/alertes inconnus ; aucune purge lancée |
| Advisors | leaked password protection désactivée ; 18 objets GraphQL découvrables authenticated, 34 SECURITY DEFINER exécutables authenticated ; audit RLS sans policy | warnings à contextualiser par RLS/gardes ; pas preuve d'accès interutilisateur ; audit table volontairement inaccessible directement |
| GitHub | main protégée, check requis strict, admins inclus, historique linéaire, résolution conversations, force-push/deletion interdits ; CI récente succès sur e80aba9 | aucun run ne couvre les changements non commités ; pas de reviewer humain requis observé ; pas preuve de release |
| Secrets CI | zéro secret dépôt, zéro environnement GitHub | secrets organisation/Cloudflare non vérifiés |
| Cloudflare HTTP | HSTS, CSP self/object none/frame none, DENY, nosniff, no-referrer présents sur / | cache HTML public max-age=0 must-revalidate diffère du no-store local ; version.json est fallback HTML ; API d'administration/previews/règles non vérifiées |
| Brevo / backup | aucune preuve d'exploitation obtenue | quotas/alertes/envois et restauration non vérifiés |

## Risques résiduels et impossibilités

| ID / sévérité / statut | Scénario, impact, preuve, correction et test attendu | Action restante |
| --- | --- | --- |
| R78-01 majeure / non vérifiable | Perte DB/Storage sans backup exploitable démontré. Documentation d'absence + offre free relue ; aucune restauration isolée. RPO/RTO inconnus. Fiches/journaux et octets Storage doivent être conservés ; backup DB seul ne sauvegarde pas les objets Storage selon Supabase. | Décider explicitement maintien du risque ou mécanisme autorisé ; inventaire et restauration isolée avant preuve de reprise. Aucun rollback de données promis. |
| R78-02 élevée / suspecté | Worker relit les références puis supprime via API Storage hors transaction ; une référence créée entre les deux pourrait pointer un objet supprimé. Sources worker + enforce_*_storage sans exclusion commune. Aucun entrelacement PostgreSQL/Storage réel reproduit. | Reproduire sur instance isolée ; si confirmé concevoir tombstone/verrou commun durable, test de concurrence ; avant scheduler automatique. |
| R78-03 élevée / confirmé (limite de contrôle) | Filtre signatures/ZIP/XML/PDF ne prouve pas innocuité complète ; historiques non analysés. Quarantaine/AV absents, source validator et finaliseurs. | Concevoir quarantaine/scan proportionné, corpus synthétique de fichiers actifs/polyglottes, inventaire autorisé sans suppression silencieuse. |
| R78-04 moyenne / confirmé | Protection mots de passe compromis désactivée selon advisor distant. Aucun test de mot de passe réel lancé. | Vérifier options/offre et autoriser réglage séparément, puis recette synthétique ; aucun upgrade payant automatique. |
| R78-05 moyenne / confirmé | Historique local/distant sections brûlage divergent d'identifiant. Même nom ne prouve pas contenu égal ; migration list et migration_sections.json. | Comparer contenu/schéma en lecture seule puis décision explicite de réconciliation avant toute application. Ne pas renommer ni repair aveuglément. |
| R78-06 moyenne / non vérifiable | CORS/previews/environnement de build distants inconnus. Helper CORS garde des défauts localhost en toute absence d'APP_ALLOWED_ORIGINS, sans garde DEV ; noms de secrets seuls présents. | Lire configuration autorisée, puis tests d'origines explicitement autorisés en environnement isolé ; CORS ne remplace jamais l'autorisation. |
| R78-07 moyenne / confirmé | 20 contraintes NOT VALID relues : nouvelles écritures contrôlées mais historique non certifié. | Inventaire agrégé autorisé avant validation explicite des contraintes, aucune purge de lignes ; tests de données synthétiques puis intégrité historique. |
| R78-08 moyenne / non vérifiable | Anti-abus Auth, audit logs effectifs, quotas/alertes Brevo, scheduler/monitoring inconnus. | Lectures plan de contrôle et recette de test avec autorisation distincte ; ni email ni compte réel utilisé. |
| R78-09 moyenne / non vérifiable | Navigateur PWA réel, upgrade SW, concurrence IDB multi-onglets, logout, reprise réseau et révocation non exercés physiquement. | Recette navigateur synthétique locale puis E2E distante autorisée ; TTL n'apprend jamais une révocation hors réseau. |
| R78-10 faible / confirmé | L'arbre node_modules initial diffère du lock et les avis dev persistent. Isolation npm ci contourne l'incertitude pour la validation, sans toucher cet arbre. | Utiliser npm ci en CI et environnement de release ; traiter dépendance dev dans évolution compatible distincte. |

Les constats R sont ouverts ; ils ne sont pas transformés en « corrigés » par
un Markdown ou un test simulé. Aucun accès interutilisateur supplémentaire
confirmé après les lectures réalisées ; cette absence de constat n'est pas
une preuve générale d'impossibilité d'accès.

## Documentation devenue inexacte

- MEDICAL_FOLLOWUP a été corrigé pour le bypass strict, la rétention et l'état
  non publié. Les autres documents préexistants sont conservés intégralement.
- security-input-audit présente les defaults CORS localhost comme DEV-only :
  le code les utilise dès qu'aucune allowlist n'est configurée, quel que soit
  l'environnement. Sa description Office/ODT doit être lue avec F78-04 et ses
  limites ; sa description de TTL ne prouvait pas la course F78-03.
- Roadmap/admin-mfa/audit septembre/remediation décrivent un historique de
  déploiement au 1er octobre. Ce rapport apporte des lectures datées récentes,
  sans faire de cet historique une preuve des correctifs de ce jour.
- Les commentaires de quota et anciens tests contradictoires sont dépassés
  par la migration additive et les tests 50/200 positifs. Les anciennes
  migrations ne sont pas réécrites.

## Plan de déploiement — à autoriser distinctement

1. Figer/revoir le diff et les sept modifications préexistantes ; aucune
   inclusion silencieuse de leur publication. Comparer/réconcilier l'historique
   sections brûlage et confirmer schémas exposés. Définir sauvegarde/reprise ou
   accepter explicitement son absence majeure. Préparer environnement isolé.
2. Après accord visant le projet Supabase lié, appliquer seulement les deux
   migrations additives revues, après répétition sur instance Supabase complète.
   Vérifier six FK RESTRICT, fonctions de quota/ACL et aucune perte de lignes.
3. Après accord Edge distinct, publier admin-users, les trois emails et les
   deux finaliseurs avec helpers. Aucun changement de secret prévu ; toute
   rotation/configuration supplémentaire nécessite son propre accord.
4. Worker/scheduler : ne pas déclencher de purge sans inventaire autorisé et
   résolution de R78-02 ; vérifier jeton, quotas, alertes et journalisation.
5. Après accord frontend/Cloudflare explicite, construire depuis lock, sans
   bypass, publier artefact identifié ; prévenir de l'invalidation des anciennes
   sélections hors ligne. Relire headers/routes/previews et cache runtime.
6. Sur comptes synthétiques et environnement autorisés séparément, recette
   REST/RPC/Storage directe : deux propriétaires, rôles/AAL/facteurs/révocation,
   changement owner/72h, concurrence planning/covoiturage/Storage, fichiers,
   logout/swap/offline/reconnexion. Email uniquement si accord spécifique.
7. Surveillance : erreurs RLS/Edge, audit_pending, quotas email/Storage, file
   cleanup, échecs MFA, rétention et disponibilité ; critères d'arrêt documentés
   avant publication. Un 200 ou un build ne valide pas ces parcours.

## Plan de retour arrière

- Local : rétablir seulement les fichiers de cette exécution depuis le diff
  relu ; ne pas toucher aux sept modifications initiales. Les preuves et les
  tests restent utiles. Aucun reset global/clean prévu.
- SQL : transactions et validation des FK protègent l'application de chaque
  migration ; si échec, transaction annulée. Après commit, privilégier correction
  additive vers l'avant. Revenir aux CASCADE/SET NULL réintroduit la perte :
  aucune migration descendante automatique proposée. Versions/ACL actuelles
  sont dans functions.json/retention.json pour préparer un rollback approuvé.
- Edge : conserver artefacts/sources de versions publiées et configuration avant
  publication ; redéployer version approuvée seulement après décision. Une
  ancienne version retire les gardes mais la FK RESTRICT doit rester. Pas de
  rollback faisant sauter silencieusement les protections.
- Frontend : republier un artefact antérieur identifié après accord ; cela peut
  réintroduire bypass/expiration et ne restaure pas les caches/clés invalidés.
  Le cache est reconstruit par nouvelle sélection depuis les sources serveur.
- Données : aucun retour arrière ni récupération de perte démontré en l'absence
  de sauvegarde/restauration testée. Les correctifs ne récupèrent pas l'historique
  perdu. Les objets Storage exigent leur propre stratégie de sauvegarde.

## Référentiels officiels consultés le 24 octobre 2026

Ces sources guident les contrôles ; aucune conformité ASVS complète n'est revendiquée.

- [OWASP ASVS 5.0.0](https://asvs.owasp.org/) : exigences d'authentification,
  autorisation, données et fichiers ; version stable affichée par le projet.
- [OWASP WSTG 4.2](https://owasp.org/projects/web-security-testing-guide) :
  méthodologie de tests ; la v5 est annoncée en développement.
- [OWASP API Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/) :
  BOLA, autorisation de fonction, consommation et flux sensibles.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
  [MFA](https://supabase.com/docs/guides/auth/auth-mfa),
  [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
  [Storage](https://supabase.com/docs/guides/storage/security/access-control),
  [Edge Auth](https://supabase.com/docs/guides/functions/auth) : couches distinctes
  de JWT, session, rôle, RLS et droits serveur.
- [Supabase backups](https://supabase.com/docs/guides/platform/backups) :
  disponibilité selon offre, restauration et exclusion des octets Storage.
- [Supabase changelog](https://supabase.com/changelog) : index Markdown relu via
  curl ; annonce TLS du 12/10 (désactivation de certains ciphers prévue le
  10/11/2026), pas de changement appliqué par cet audit.
- [Cloudflare headers](https://developers.cloudflare.com/pages/configuration/headers/)
  et [previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/) :
  configuration publiée à distinguer du fichier local et des previews.
- [Brevo limites API](https://developers.brevo.com/docs/api-limits) : plafonds
  fournisseur distincts des quotas applicatifs ; compte fournisseur non vérifié.
- [Avis PostCSS](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) : risque de
  complexité sur sélecteurs hostiles ; build CSS de confiance hors de ce scénario.
- [Vite — variables et modes](https://vite.dev/guide/env-and-mode#node-env-and-modes) :
  DEV/PROD dépendent de NODE_ENV ; garde de build explicite ajouté et testé.

## Surface IA

Non applicable à l’application actuelle ; périmètre inspecté : code frontend,
Edge Functions, migrations, dépendances, workflows et documentation.
