# Audit de sécurité Flashover78 — 18–20 septembre 2026

Mise à jour de consolidation du 20 septembre 2026 : pagination Auth et des
collections applicatives, bornes défensives des RPC, quota email par utilisateur
et coupe-circuit global, contrôle de namespace/quota Storage, liaison des versions aux
objets Storage, session active sur les prédicats RLS et RPC, bornes serveur
résiduelles, CORS à liste blanche, durée de rétention hors ligne, file de
nettoyage Storage, finalisation/canonicalisation serveur des PDF de formulaires,
inspection bornée des paquets Office, sélection explicite des clés serveur,
normalisation anti-énumération des erreurs Auth et revalidation Auth en ligne du
cache hors ligne, alignement des RPC documentaires de publication avec le rôle
contributeur, suppression du défaut de qualification `RSFR`, restriction des
destinataires email, lecture seule du calendrier pour les membres et
chiffrement AES-GCM du cache documentaire hors ligne ont été ajoutés puis
retestés localement. Les migrations
restent préparées dans le dépôt : aucune n'a été appliquée à distance.

## Mise à jour de vérification distante — 25 septembre 2026

Une vérification en lecture seule a ensuite été réalisée sur la cible Supabase
« Flashover78 », le dépôt GitHub et le projet Cloudflare Pages. Elle n'a extrait
aucune ligne métier, aucun chemin Storage et aucune valeur de secret.

- **Supabase.** Le projet lié est bien « Flashover78 ». L'historique distant
  contient 27 versions jusqu'à `20260917172518`; le SQL de cette dernière
  version correspond aux fonctions MFA/journal du fichier local renommé
  `20260917172518_admin_totp_and_auth_audit.sql`. Les 16 migrations de
  durcissement datées du 18 au 20 septembre restent en attente ; le
  `supabase db push --dry-run` les énumère sans erreur après cet alignement.
  Les 18 tables `public` observées ont RLS active et aucune contrainte
  `NOT VALID` n'est actuellement remontée. En revanche, la policy distante
  `email_destinations_select_authenticated` autorise encore une lecture
  `using true` à tout membre authentifié : la correction locale
  `20260920064931_restrict_email_destinations.sql` n'est donc pas active.
- **Storage.** Les sept buckets inventoriés sont privés. Le comptage sans noms
  retourne 7 objets dans `brulage-documents` (7 687 402 octets déclarés) et
  2 objets dans `main-courantes` (250 337 octets), sans référence cassée,
  orphelin, anomalie de namespace ou ancien `.doc`/`.ppt` détecté. Les tables
  privées des approbations de finalisation n'existent pas encore, ce qui est
  cohérent avec les migrations en attente.
- **Edge Functions et secrets.** Quatre fonctions sont actives à distance
  (`admin-users`, `medical-follow-up-email`, `main-courante-email`,
  `equipment-repair-email`) avec vérification JWT activée. Les fonctions
  locales `store-form-pdf`, `store-document` et `storage-cleanup-worker` ne
  sont pas encore déployées. Les noms Brevo et clés Supabase sont présents ;
  les secrets `APP_ALLOWED_ORIGINS`, `APP_ALLOWED_REDIRECT_ORIGINS` et
  `STORAGE_CLEANUP_WORKER_SECRET` ne sont pas présents.
- **Sauvegardes.** `supabase backups list` renvoie `walg_enabled=true`,
  `pitr_enabled=false` et une liste de sauvegardes vide. Aucun point de retour
  exploitable n'est donc prouvé ; aucune migration distante ne doit être
  poussée avant la création ou la confirmation d'une sauvegarde restaurable.
- **Cloudflare Pages.** Le projet `flashover78` est relié à
  `fab72309/flashover78`, construit avec `npm run build` vers `dist`, déploie
  automatiquement `main` et sert `app.flashover78.com`. Avant la nouvelle
  livraison, la réponse de production exposait `Access-Control-Allow-Origin: *`
  et ne renvoyait ni CSP, ni HSTS, ni `X-Frame-Options`. La restriction
  Cloudflare Access des previews a été activée pendant cette vérification ;
  elle doit être revalidée sur un nouveau déploiement. Les variables publiques
  observées incluent `VITE_DEV_AUTH_BYPASS=false`, l'URL Supabase et la clé
  publishable/anon (valeurs non recopiées).
- **GitHub.** La branche `main` n'a pas de protection distante et aucun
  workflow n'est présent sur `main` ; le workflow local épinglé
  `.github/workflows/security-check.yml` ne sera effectif qu'après push et
  exécution réussie.

Ces observations sont datées et ne valent que pour les lectures effectuées le
25 septembre 2026 ; elles ne remplacent ni une recette avec comptes
synthétiques ni la preuve d'une restauration.

## Portée, méthode et niveau de preuve

Audit local du dépôt sur la branche `codex/security-audit-2026-09-18`, sans
déploiement, push, migration distante, email réel, changement DNS ou test actif
de production. Les scénarios utilisent uniquement des identités et données
synthétiques. L'absence de constat dans ce rapport ne garantit pas l'absence de
vulnérabilité.

Aucun `AGENTS.md` applicable n'a été trouvé dans ce dépôt ou ses répertoires
parents ; les quatre documents de cadrage demandés ont été relus et
réconciliés avec le code.

Quatre niveaux de preuve sont séparés :

| Niveau | Signification | État de cet audit |
| --- | --- | --- |
| Documenté | Affirmation d'un Markdown ou d'une feuille de route | Réconcilié avec le code ; plusieurs affirmations étaient obsolètes |
| Présent dans le code | Contrôle réellement implémenté dans le dépôt | Inspecté statiquement sur `src/`, migrations et Edge Functions |
| Testé localement | Contrôle exercé par Vitest, Node ou PostgreSQL PGlite isolé | Oui, détails dans « Validation » |
| Vérifié à distance | Configuration/déploiement réellement observé sur un service autorisé | Supabase, Storage, Edge, sauvegardes, GitHub et Cloudflare vérifiés en lecture seule le 25 septembre 2026 |

Référentiels consultés et revérifiés le 20 septembre 2026 :

- [OWASP ASVS 5.0.0](https://owasp.org/projects/asvs), publié en mai 2025,
  notamment V5 (fichiers), V6 (authentification) et V8 (autorisation) ;
- [OWASP WSTG 4.2](https://wstg.owasp.org/v4.2/), dernière version stable ;
  la version 5.0 est encore en développement ;
- [OWASP API Security Top 10 — édition 2023](https://api-security.owasp.org/editions/2023/en/0x00-header/),
  notamment API1, API3, API4, API5 et API9 ;
- documentation officielle Supabase : [sessions](https://supabase.com/docs/guides/auth/sessions),
  [MFA](https://supabase.com/docs/guides/auth/auth-mfa),
  [journaux Auth](https://supabase.com/docs/guides/auth/audit-logs) et
  [contrôle Storage](https://supabase.com/docs/guides/storage/security/access-control),
  [fonctions `storage.foldername`/`storage.filename`](https://supabase.com/docs/guides/storage/schema/helper-functions)
  et [dépendances Edge](https://supabase.com/docs/guides/functions/dependencies),
  ainsi que les [limites d'exécution Edge](https://supabase.com/docs/guides/functions/limits) ;
- documentation officielle Cloudflare Pages :
  [headers](https://developers.cloudflare.com/pages/configuration/headers/) et
  [previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

OWASP LLM n'est pas applicable à l'application actuelle : aucune intégration
LLM, chatbot, RAG, embedding, outil agentique ou pipeline IA n'a été trouvée
dans `src/`, `supabase/functions/`, les migrations, manifestes, dépendances,
documentation ou workflows. Le `tsvector` PostgreSQL est une recherche plein
texte classique.

## Cartographie technique

### Surfaces et flux principaux

| Surface | Entrée → validation | Authentification / autorisation | Stockage → restitution |
| --- | --- | --- | --- |
| Connexion, inscription, récupération | email/mot de passe → Supabase Auth + contrôles UI | session Supabase ; profil synchronisé par RPC | Auth + `profiles` → session navigateur |
| Compte | identité/email/mot de passe → contraintes + réauthentification | propriétaire courant | Auth/`profiles` → compte |
| Administration | rôle, qualifications, invitations, destinataires | rôle courant en base + session active + AAL2 + AMR TOTP + facteur vérifié | Auth/`profiles`/destinataires → interface admin et audit métier |
| Calendrier | titre, date, formateurs, capacité | contributeur/admin pour contenu et capacité ; admin AAL2 pour coordonnées/audit | `events`, inscriptions, audit → calendrier/CSV |
| Suivi médical | questionnaire + PDF navigateur | propriétaire `auth.uid()`, qualification, fenêtre 72 h | `medical_follow_ups` → historique/PDF/email |
| Main courante / réparation | formulaire + PDF privé | propriétaire ; objet Storage sous chemin utilisateur | table + bucket privé → URL signée/email |
| Documents | fichier + métadonnées | contributeur pour version ; admin AAL2 pour suppression | buckets privés + catalogue/version/audit → URL signée/cache hors ligne |
| Covoiturage | offre/besoin/match | membre impliqué ; admin AAL2 pour dérogation | tables/RPC → coordonnées après acceptation |
| Email transactionnel | identifiant + pièce jointe | JWT utilisateur, propriété, revendication atomique | Brevo serveur → destinataires configurés |
| Hors ligne | sélection explicite | compte courant lié au cache | Cache Storage + métadonnées IndexedDB chiffrées → consultation locale |

Routes protégées observées : accueil, calendrier, ajout/détail session, brûlage,
suivi médical, main courante, réparation, ressources, ajout/détail document,
tableau de bord, paramètres, compte et covoiturage. Les routes d'administration
(utilisateurs, destinataires, comptes et sécurité) ajoutent rôle et MFA. Les
routes publiques sont limitées à connexion, oubli et réinitialisation du mot de
passe.

Inventaire backend : 21 tables applicatives finales dans `public`, une table de
quota privée, une file privée de nettoyage et deux tables d'approbations PDF/document,
environ 30 RPC, triggers d'invariants, buckets documentaires privés, buckets
privés main courante/réparation, six Edge Functions métier sensibles et un
worker Edge de nettoyage non navigateur. Les RPC appelés par le
frontend, les tables exposées et les objets Storage ont été recroisés avec les
migrations additives `20260919090000_active_session_rls.sql`,
`20260919130000_rpc_active_session_hardening.sql`,
`20260919140000_storage_lifecycle_hardening.sql`,
`20260919150000_input_bounds_hardening.sql`,
`20260919160000_storage_cleanup_worker.sql`,
`20260919170000_form_pdf_server_finalization.sql`,
`20260919180000_document_server_finalization.sql`,
`20260919180022_block_legacy_office_uploads.sql` et
`20260919190000_query_response_bounds.sql`,
`20260919190100_carpool_lock_order_hardening.sql`,
`20260919190200_global_form_email_rate_limit.sql`,
`20260920064930_remove_default_trainer_qualification.sql`,
`20260920064931_restrict_email_destinations.sql` et
`20260920065639_training_planning_member_view_only.sql`. Les helpers Edge de sélection de clés
et d'inspection bornée des paquets Office sont également inclus dans la revue.
Aucun `VIEW`, SQL dynamique
`EXECUTE`, publication Realtime ou configuration GraphQL explicite n'a été
trouvé ; un workflow CI de sécurité est préparé dans `.github/`. Cela ne prouve
pas leur absence distante ni l'exécution effective du workflow.

### Classification des données

| Classe | Exemples | Accès/destinataires attendus | Conservation et contrôles distants |
| --- | --- | --- | --- |
| Identité | nom, email, rôle, qualifications | propriétaire ; annuaire limité ; admin AAL2 | durée du compte + obligations internes |
| Coordonnées | téléphone/email covoiturage | participants acceptés strictement impliqués | durée du trajet et règles de suppression |
| Formation | planning, inscriptions historiques, présence, capacités | membre : consultation du planning ; contributeur/admin : gestion ; coordonnées admin | conservation dans les sauvegardes décidée ; chiffrement, durée et restauration à vérifier |
| Suivi médical | symptômes, hydratation, observations | propriétaire ; destinataires email configurés séparément | conservation dans les sauvegardes décidée ; chiffrement, habilitations et restauration à vérifier |
| Observations opérationnelles | main courante, réparation | propriétaire et destinataires de service | durée d'archive à formaliser |
| Réseau/authentification | IP et événements Auth | administrateur AAL2 | 90 jours est un filtre, pas une purge |
| Documents | référentiels, PDF, métadonnées | utilisateurs authentifiés selon catalogue | historique et purge d'objets à définir |
| Secrets | service role, Brevo, TOTP | Edge/Supabase uniquement | rotation et réponse à incident distantes |

Cet audit technique ne conclut pas à une conformité juridique. Les bases
légales, durées, destinataires, droits des personnes, sauvegardes et procédures
d'incident doivent être validés par les responsables compétents.

## Matrice acteur × ressource × action

`✓` autorisé par le code final attendu, `—` refusé, `D` décision métier ouverte.

| Acteur | Profil/annuaire | Calendrier | Inscriptions | Documents | Covoiturage/contacts | Fiches personnelles | Administration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Visiteur non authentifié | — | — | — | — | — | — | — |
| Membre | propre profil + annuaire limité | lecture seule | — (consultation du planning uniquement) | lecture, favoris, hors ligne chiffré | créer/gérer ses publications ; contacts acceptés impliqués | propres fiches ; médical si qualification | — |
| Contributeur | droits membre | créer/modifier le planning et la capacité | mutations de reporting autorisées par RPC | publier de nouvelles versions immuables | droits membre | droits membre | — |
| Admin AAL1 | droits contributeur | contenu non privilégié | refus admin | publication, mais suppression admin refusée | droits propres seulement | droits propres | — |
| Admin AAL2 TOTP + session active | droits cumulatifs | calendrier, capacité, suppression/audit | gestion et reporting | suppression/audit | dérogation admin | droits propres sauf règle spécifique | ✓ |
| Autre propriétaire | annuaire limité | lecture | aucune donnée privée d'autrui | documents partagés seulement | aucune coordonnée sans match accepté | — | — |
| Compte rétrogradé | rôle courant immédiatement relu | droits du nouveau rôle | droits du nouveau rôle | droits du nouveau rôle | droits du nouveau rôle | propres données | — |
| Session révoquée | JWT ordinaire potentiellement valide jusqu'à expiration | refus par `private.has_active_session()` après migration RLS | refus par `private.has_active_session()` après migration RLS | refus par `private.has_active_session()` après migration RLS | refus par `private.has_active_session()` après migration RLS | refus par `private.has_active_session()` après migration RLS | refus immédiat par `session_id` |

Le modèle réellement implémenté est cumulatif : membre < contributeur <
administrateur. `RSFR`, `FOR INC` et `FOR BAT` sont des qualifications et ne
confèrent pas un privilège administratif.

Pour rendre explicites les actions derrière cette matrice, le contrôle serveur
attendu se résume ainsi :

| Acteur | Ressource sensible | Lire | Créer/insérer | Modifier | Supprimer/partager |
| --- | --- | --- | --- | --- | --- |
| Visiteur / session révoquée | toutes les ressources protégées | — | — | — | — |
| Membre ou autre propriétaire | profil, fiches et documents d'autrui | — | — | — | — |
| Membre propriétaire | ses fiches, ses trajets, ses documents hors catalogue | ✓ | ✓ selon règle métier | ✓ dans les fenêtres prévues | partage email uniquement vers les destinataires serveur autorisés |
| Contributeur | catalogue documentaire | métadonnées autorisées | nouvelle version | sa version immuable ; pas d'écrasement | — |
| Administrateur AAL1 | capacités, rôles, suppression, audit | — | — | — | — |
| Administrateur AAL2 + TOTP + session active | administration et dérogations | ✓ | ✓ | ✓ | ✓ selon RPC/audit |

Les qualifications de formation n'élargissent aucune de ces colonnes. Les
partages médicaux et les coordonnées de covoiturage conservent en outre leur
propriété et leurs destinataires spécifiques ; le tableau ne remplace pas les
policies RLS détaillées.

## Constats et corrections

### Confirmés et corrigés localement

| ID | Sévérité | Scénario / impact | Correction locale | Preuve locale | Distant |
| --- | --- | --- | --- | --- | --- |
| A-01 | Élevée | Un contributeur écrasait directement un objet Storage, contournant versions et audit | suppression UPDATE Storage, uploads `upsert:false`, extensions/namespace/quota côté policy et SQL, suppression d'orphelin propriétaire seulement | migration sections Storage et trigger version (lignes 177-438, 939-974) ; service ligne 740 ; test de build | migration non appliquée |
| A-02 | Élevée | PATCH direct de `events.capacity` par contributeur/admin AAL1 contournait MFA/RPC/audit | privilèges INSERT/UPDATE par colonnes, capacité omise du client direct | migration lignes 150-175 ; PGlite refuse INSERT/UPDATE capacité et maintient titre | non appliqué |
| A-03 | Élevée | Un passager accepté voyait les coordonnées des autres passagers | résultat contextuel : propriétaire/admin voit les contreparties ; passager voit seulement l'auteur | migration lignes 439-542 ; PGlite avec deux passagers + tiers | non appliqué |
| A-04 | Moyenne | RPC legacy renvoyait demandes pending/rejected/cancelled | filtre strict `status='accepted'` | migration lignes 439-496 ; test legacy accepted/pending | non appliqué |
| A-05 | Moyenne | propriétaire supprimait un PDF référencé ; suppression catalogue supprimait Storage avant DB | DELETE Storage permis seulement si non référencé ; suppression catalogue DB avant purge | migration lignes 403-438 ; service lignes 3108-3134 ; revue statique | non appliqué |
| A-06 | Élevée pour admin | JWT AAL2 restait privilégié après révocation de session | `private.has_active_session()` intégré au prédicat MFA | migration 8-49 ; PGlite avant/après suppression `auth.sessions` | durée JWT et déploiement inconnus |
| A-08 | Élevée | un JWT encore valide pouvait appeler 18 RPC `SECURITY DEFINER` après révocation de sa session | ajout d'un garde `private.has_active_session()` aux signatures finales, avec contrôle rejouable et sans wrapper permissif | `20260919130000_rpc_active_session_hardening.sql` ; `rpc-active-session-check.mjs` (18/18, rejeu deux fois) | migration et E2E REST/RPC non appliqués |
| A-09 | Moyenne | une suppression DB ou un upload PDF abandonné pouvait laisser des objets Storage sans reprise | quota PDF par propriétaire, trigger d'enqueue idempotent, RPC d'enqueue limité, worker service-role à secret dédié avec backoff et recontrôle de référence | `20260919140000_storage_lifecycle_hardening.sql`, `20260919160000_storage_cleanup_worker.sql` ; tests de cycle de vie et worker | worker/inventaire non déployés |
| A-10 | Moyenne disponibilité | des annulations concurrentes de covoiturage pouvaient verrouiller une publication cible puis une contrepartie dans un ordre différent et provoquer un deadlock | remplacement additif de `cancel_carpool_post` : toutes les publications liées sont verrouillées par UUID croissant avant les lignes de correspondance, avec garde de session conservée | `20260919190100_carpool_lock_order_hardening.sql` ; `carpool-lock-order-check.mjs` (rejeu SQL et ordre vérifié) | migration non appliquée ; concurrence PostgreSQL distante à éprouver |
| B-01 | Élevée conditionnelle | première inscription d'une instance vide devenait administrateur | `sync_my_profile` crée toujours un membre et préserve les rôles existants | migration 58-115 ; PGlite premier compte + admin existant | bootstrap initial explicite requis |
| B-02 | Moyenne | session détournée changeait email/mot de passe sans preuve récente | mot de passe actuel exigé, réauthentification avant mutation | service lignes 2113-2148 ; formulaires `AccountForms.tsx`/`ResetPassword.tsx` ; build/tests | réglage Auth distant inconnu |
| B-03 | Moyenne | nouveaux mots de passe de six caractères acceptés localement | minimum 15, maximum 128 sur inscription/reset/admin ; connexion existante reste compatible | `authRecovery.ts:5`, Edge admin 482 ; tests Vitest | politique Supabase distante à aligner |
| B-12 | Moyenne | les réponses Auth « email non confirmé » et certaines erreurs fournisseur pouvaient distinguer un compte ou révéler une allowlist SMTP | normalisation commune vers un message non énumérant, puis assainissement défensif dans les écrans connexion/récupération/réinitialisation | `authErrors.ts`, `userFacingError.ts`, tests Vitest et build ; recherches statiques sans message fournisseur rendu | comportement exact du fournisseur Auth et limites anti-abus distants non vérifiés |
| B-04 | Moyenne | double envoi concurrent et rejeu illimité | transition atomique vers `sending`, cooldown 1 min, récupération 10 min, plafond 5 | migration lignes 706-848 ; PGlite deux revendications | fonctions/migration non déployées |
| B-05 | Moyenne | création Auth réussie mais profil échoué laissait un compte incohérent ; confirmation/récupération pouvait utiliser une origine arbitraire | compensation par suppression, allowlist d'origine pour invitations et redirections Auth de confirmation/récupération, journal métier | `admin-users` local, `authRecovery.test.ts` et build | allowlist Supabase distante et comportement Auth réel à vérifier |
| B-06 | Moyenne | journal Auth ne traçait pas les opérations métier et masquait un ancien admin rétrogradé | table append-only `admin_operation_audit`, tentative obligatoire avant mutation, lecture paginée admin AAL2 ; les succès dont l'écriture d'audit échoue renvoient désormais `audit_pending` avec `operationCompleted=true` pour réconciliation | migration d'audit ; `admin-api-check.mjs` (audit préalable et succès indisponible) | transaction inter-services impossible, conservation, reprise et alertes à compléter |
| C-02 | Moyenne | appels directs envoyaient sièges/champs texte hors bornes | contraintes sièges 1..8, profils/événements, destinataires et formulaires avec bornes `NOT VALID` | migration lignes 153-176 et 849+ ; PGlite refuse titre/nom hors bornes | données historiques à inventorier/valider |
| C-03 | Faible | variantes de formule CSV et contrôles initiaux | neutralisation ASCII/pleine largeur et C0, guillemets doublés | `csv.ts:1-18`, tests tab/CR/Unicode | Excel/LibreOffice réel non testé |
| C-06 | Faible à moyenne | les validateurs email acceptaient des délimiteurs URI dans le domaine et les liens `mailto:`/`tel:` concaténaient des valeurs dynamiques sans encodage | regex de domaine stricte côté client/Edge/Brevo, filtrage et encodage percent des destinataires du fallback et des liens de contacts | test Vitest `toMailtoRecipientList`, harnais Edge, build | configuration distante et clients mail réels non testés |
| C-07 | Moyenne | appels directs pouvaient envoyer des PDF et tableaux/formulaires non bornés malgré une interface limitée | bornes `NOT VALID` complémentaires sur taille/nom/chemin PDF, tableaux et champs métier legacy | `20260919150000_input_bounds_hardening.sql` ; `input-bounds-check.mjs` (5 refus négatifs) | données historiques à inventorier puis contraintes à valider |
| D-01 | Élevée | document privé persistait après logout ou changement de compte | cache lié à l'ID, purge cache+métadonnées même si la déconnexion distante échoue, rétention locale maximale de 24 h ; octets chiffrés AES-GCM avec clé non exportable par compte ; fallback local non privilégié et session expirée refusée ; revalidation de l'utilisateur et de `require_active_session` avant restitution lorsque le navigateur est en ligne ; SW ne supprime plus arbitrairement ce cache lors d'une release | `offlineDocuments.ts`, `AuthContext.tsx`, tests lifecycle/chiffrement, build | navigateur de production et support IndexedDB/WebCrypto à vérifier |
| D-02 | Moyenne | absence de CSP/frame/cache applicatifs explicites | `_headers` Cloudflare, JS/CSS inline de boot externalisés | build copie `_headers`, aucun script inline | headers absents de la production observée ; restriction previews activée mais nouveau déploiement à vérifier |
| D-06 | Faible à moyenne | plusieurs écrans restituaient `error.message`, et la console navigateur recevait parfois l'objet d'erreur complet, pouvant révéler SQL/PostgREST, URL ou fournisseur | helper `getUserFacingError()` appliqué aux pages, composants et hook identifiés, y compris connexion/récupération/réinitialisation ; `logClientFailure()` remplace les payloads bruts par un contexte fixe ; détails conservés hors interface | `userFacingError.ts`, `authErrors.ts`, `clientDiagnostics.ts` + tests Vitest ; recherches `rg` sans sortie UI ni payload console brute ; build | interface et collecte de logs distantes non testées |
| D-07 | Moyenne | les Edge Functions sensibles répondaient avec `Access-Control-Allow-Origin: *` | liste d'origines contrôlée par défaut et par `APP_ALLOWED_ORIGINS`, refus 403 des origines inconnues, préflight explicite | `_shared/cors.ts`, six fonctions, `cors-check.mjs` | trois secrets CORS/redirect absents et fonctions corrigées non déployées ; CORS runtime reste à tester |
| D-08 | Moyenne | le Service Worker pouvait mettre en cache toute réponse GET, y compris de futures routes privées | version de cache v4 et cache limité aux extensions statiques ; templates/réponses API en réseau uniquement | `public/sw.js`, build ; revue statique | Cache Storage d'un navigateur réel non testé |
| D-09 | Moyenne | des URLs Blob et des continuations asynchrones pouvaient survivre à logout/changement de compte dans le détail documentaire | nettoyage séparé des URLs ouverture/téléchargement, génération de chargement et contrôle de l'utilisateur courant avant tout état | `DocumentDetail.tsx`, build TypeScript | scénario navigateur réel à exécuter |
| D-10 | Faible | les ouvertures de fenêtres dynamiques ne neutralisaient pas explicitement l'opener | `noopener,noreferrer` sur les parcours main courante/médical/réparation | trois utilitaires ; lint/build | navigateur réel non testé |
| D-05 | Faible | l'écran de démarrage affichait le message brut d'une exception JavaScript et le bootstrap journalisait parfois son payload | message utilisateur générique ; journal bootstrap réduit à un contexte fixe, sans payload | `public/boot.js`, `main.tsx`, build local | en-têtes et collecte de console distants non vérifiés |
| D-11 | Moyenne | les listes PostgREST et plusieurs RPC de collection pouvaient renvoyer une réponse non bornée, permettant une consommation excessive et des réponses instables | pagination par pages de 100 avec plafond explicite de 1 000 lignes et sonde anti-troncature pour les historiques/calendrier/covoiturage ; limites SQL de 200 documents/versions, 500 participants et 1 000 résumés | `src/utils/paginate.ts`, `paginate.test.ts`, `query-bounds-check.mjs` (2/2), lint/build | migration `20260919190000_query_response_bounds.sql` et limites client non appliquées à distance ; le catalogue au-delà de 200 devra disposer d'une UX de page/cursor avant de considérer le besoin fonctionnel clos |

| B-13 | Moyenne | les contributeurs pouvaient ouvrir les écrans de publication documentaire, mais les RPC de création/version exigeaient encore administrateur AAL2, provoquant un refus incohérent ; l'édition de métadonnées restait administrative côté SQL | migration additive `20260919200000_document_contributor_publish.sql` remplace uniquement la garde des RPC de création/nouvelle version par `private.has_role('contributor')`, tandis que l'éditeur de métadonnées est affiché aux administrateurs seulement | `document-contributor-publish-check.mjs` (contributeur accepté, membre refusé, rejeu), build | migration non appliquée |
| B-14 | Moyenne | la création de profil cochait implicitement `RSFR`, ce qui pouvait étendre l'accès formateur ou médical sans décision administrative | defaults SQL et normalisation frontend/Edge passent à `[]`; l'administrateur peut aussi retirer toutes les qualifications | `20260920064930_remove_default_trainer_qualification.sql`, `trainer-level-default-check.mjs`, tests Vitest, build | migration et profils historiques à vérifier |
| B-15 | Moyenne | un membre authentifié pouvait lire les adresses opérationnelles de `email_destinations` via la Data API | policy RLS admin AAL2 ; les fonctions email continuent la lecture par client serveur ; aucune adresse n'est nécessaire au parcours membre | `20260920064931_restrict_email_destinations.sql`, `email-destinations-rls-check.mjs`, build | policy et fonctions déployées non vérifiées |
| B-16 | Moyenne | les RPC de reporting de formation acceptaient une mutation directe d'un membre et la capacité restait admin-only malgré le rôle contributeur du planning | garde `private.has_role('contributor')` sur inscription/annulation/capacité ; UI capacité contributeur sans coordonnées participants ; membres en consultation | `20260920065639_training_planning_member_view_only.sql`, `training-planning-member-view-check.mjs`, build | migration et E2E REST/RPC non appliqués |

Les sévérités élevées exigent des préconditions (compte contributeur,
administrateur AAL2 volé, passager accepté ou propriétaire). Elles restent
élevées car elles permettent une atteinte transversale à l'intégrité, la
confidentialité ou une action privilégiée hors du chemin audité.

### Confirmés, partiellement corrigés ou ouverts

| ID | Sévérité | Statut | Risque / blocage précis | Action nécessaire |
| --- | --- | --- | --- | --- |
| C-01 | Élevée | Corrigé localement, distant non vérifié | la fonction de suivi médical relit la ligne appartenant à l'appelant, génère la pièce jointe à partir des données persistées et la canonicalise avant Brevo ; aucun PDF ni nom de fichier fourni par le navigateur n'est utilisé pour l'email | déployer la fonction, vérifier le rôle/RLS sur l'instance et ajouter une analyse/quarantaine antivirus proportionnée si le niveau de menace l'exige |
| C-04 | Élevée | Partiel | les PDF de main courante/réparation passent par `store-form-pdf`, avec octets contrôlés, suppression des actions/annotations actives et approbation à usage unique ; le PDF médical est maintenant généré puis canonicalisé côté serveur ; le catalogue passe par `store-document`, avec inspection ZIP bornée des paquets ODT/DOCX/PPTX (macros, ActiveX, objets embarqués, relations externes, traversal et tailles excessives refusés) ; les nouveaux `.doc`/`.ppt` legacy sont désormais refusés, mais les fichiers historiques ne bénéficient toujours pas d'une analyse antivirus complète | déployer les finaliseurs et fonctions email, inventorier/quarantainer les historiques puis ajouter une analyse antivirus proportionnée avant toute réintroduction des formats legacy |
| A-07 | Moyenne | Partiel | les uploads documentaires directs sont maintenant refusés par Storage ; `store-document` impose une vérification d'octets, un quota de 200 objets/100 Mo par propriétaire et une approbation liée à la version ; une file et un worker sont préparés, mais les objets historiques/orphelins, `news-images` et la réconciliation du quota n'ont pas été inventoriés | exécuter `supabase/operations/storage-inventory.sql` en lecture seule, valider les contraintes puis autoriser la purge |
| C-05 | Moyenne | Partiel | suppression DB puis Storage évite un catalogue cassé ; un échec Storage est signalé, mis en file et traité par le worker local avec retry/backoff et recontrôle des références, mais le worker n'est pas déployé ni alerté à distance | déployer le worker avec `STORAGE_CLEANUP_WORKER_SECRET` ou un bearer service-role strictement serveur, scheduler, alertes et smoke test synthétique |
| B-07 | Faible à moyenne | Corrigé localement | les branches admin exposent désormais des messages publics génériques ; les erreurs fournisseur email sont réduites à un statut et un code HTTP, sans corps fournisseur | test Edge de validation, revue des fonctions email ; corrélation serveur et conservation restent à vérifier |
| B-08 | Moyenne | Partiellement corrigé localement | plafond de cinq tentatives par soumission, quota atomique de 20 revendications par utilisateur et par heure et coupe-circuit transactionnel global de 200 revendications par heure pour les trois formulaires ; les seuils fournisseur, destinataire et coût Brevo restent distants | `security-hardening-check.mjs` 20 succès/21e refus ; `global-email-rate-limit-check.mjs` 200 comptes synthétiques acceptés puis 201e refusé ; seuils fournisseur et alertes à configurer |
| B-09 | Faible | Corrigé localement | `admin-users` accepte page 1–1000 et 1–100 utilisateurs ; le client parcourt les pages jusqu'à `hasMore=false` | test Edge + build ; volume réel et comportement Auth distant non vérifiés |
| B-10 | Moyenne | Corrigé localement, instance complète non vérifiable | une migration dédiée ajoute `private.has_active_session()` aux politiques RLS de lecture/écriture exposées ; les clauses obsolètes `news/news_reads` ont été retirées pour que la migration soit rejouable après leur suppression ; une session supprimée ne lit plus même un calendrier synthétique | appliquer `20260919090000_active_session_rls.sql` après inventaire des tokens et vérifier une instance Supabase complète |
| B-11 | Moyenne | Corrigé localement, configuration distante non vérifiée | les cinq Edge Functions qui résolvent plusieurs clés n'acceptent plus la première valeur arbitraire d'un JSON ; une clé legacy ou `default` explicite est requise, sinon l'appel échoue fermé | `supabase/functions/_shared/config.ts`, `config.test.ts` ; build et tests Vitest | vérifier les secrets réellement configurés et leur correspondance au projet |
| D-03 | Moyenne | Préparé localement | workflow CI avec permissions minimales, actions épinglées, Node 22, lint/tests/build/audit, CORS, finaliseur PDF, worker et harnais d'autorisation PGlite/Edge isolés | exécution GitHub et protections de branche non vérifiées |
| D-04 | Moyenne | Corrigé localement, navigateur réel non vérifié | une durée maximale locale de 24 h est appliquée aux documents explicitement mis en cache ; les octets et l’index de métadonnées sont chiffrés AES-GCM avec une clé non exportable par compte ; une revalidation Auth (`getUser` + `require_active_session`) est exigée avant restitution lorsque le navigateur est en ligne ; par définition, un appareil réellement hors ligne ne peut toujours pas apprendre une révocation distante pendant cette fenêtre | vérifier un navigateur réel, le support IndexedDB/WebCrypto et le compromis de révocation hors ligne |
| OPS-01 | Élevée non vérifiable | Ouvert | sauvegarde, restauration, alertes, quotas, rate limits, CAPTCHA, JWT et réponse à incident inconnus | contrôle distant autorisé + exercice de restauration |

### Décisions métier intégrées et points encore ouverts

- Le calendrier est un planning/reporting : les membres consultent seulement ;
  les contributeurs et administrateurs le gèrent. Les RPC historiques de
  reporting refusent désormais les mutations directes d’un membre.
- `RSFR`, `FOR INC` et `FOR BAT` sont des qualifications explicitement gérées
  par un administrateur ; une création sans sélection conserve `[]`.
- `email_destinations` n’est pas une donnée membre : la policy RLS réserve sa
  lecture à l’administration AAL2 et les fonctions email utilisent le client
  serveur.
- Les journaux et données médicales sont conservés dans les sauvegardes ; il
  reste à vérifier à distance le chiffrement, la rétention et la restauration.
- Le cache hors ligne est lié au compte, limité à 24 heures, revalidé en ligne
  et ses octets comme son index de métadonnées sont chiffrés localement dans
  IndexedDB avec une clé non exportable par compte. `localStorage` ne conserve
  plus que la marque de propriétaire hachée et les anciennes valeurs plaintext
  sont supprimées. La révocation distante reste inconnue pendant une période
  réellement hors connexion ; le navigateur réel n’a pas encore été testé.
- Les previews Cloudflare Pages étaient publiques par défaut ; la restriction
  Cloudflare Access a été activée et une URL de branche renvoie désormais une
  redirection Access. La production et un nouveau preview doivent encore être
  vérifiés après livraison des headers.

## Validation locale

| Commande | Résultat | Ce que cela prouve / ne prouve pas |
| --- | --- | --- |
| `npm run check` | réussi : lint, build Vite (2 650 modules), 26 fichiers et 103 tests Vitest | validation locale du code ; pas la production |
| `npm audit --audit-level=high` | 0 vulnérabilité signalée | état du graphe npm local au contrôle ; pas l'exploitabilité ni les services |
| scan de `dist/` | aucun `service_role`, clé Brevo, bypass de développement ou source map trouvé | artefact local contrôlé ; pas le bundle réellement servi |
| `node --test supabase/tests/admin-api-check.mjs` | 10/10 | ordre rôle/MFA avant service role, audit fail-closed avant mutation, état `audit_pending`, compensation simulée et erreurs publiques génériques |
| `... node --test supabase/tests/admin-mfa-check.mjs` | 10/10 | AAL/AMR/TOTP/session/audit dans PGlite |
| `... node --test supabase/tests/security-hardening-check.mjs` | 5/5 | capacité, bootstrap, contacts, Storage direct et quota email dans PGlite |
| `... node --test supabase/tests/active-session-rls-check.mjs` | 1/1 | rejeu sur fixture sans `news/news_reads` et refus de lecture après suppression de `auth.sessions` |
| `... node --test supabase/tests/rpc-active-session-check.mjs` | 1/1 | 18 RPC protégées structurellement et migration rejouable deux fois |
| `... node --test supabase/tests/storage-lifecycle-check.mjs` | 1/1 | quota PDF avec borne inclusive, refus de taille hors borne/cast dangereux, liaison objet et queue de nettoyage |
| `... node --test supabase/tests/input-bounds-check.mjs` | 1/1 | cinq insertions synthétiques hors bornes refusées côté SQL |
| `... node --test supabase/tests/storage-cleanup-worker-db-check.mjs` | 1/1 | RPC service-role, claim concurrent-safe, recontrôle des références, backoff et erreur bornée |
| `node --test supabase/tests/storage-cleanup-worker-check.mjs` | 6/6 | secret dédié ou bearer service-role serveur, suppression synthétique, skip si référence revenue, claim obsolète conservé et reprise après erreur Storage |
| `node --test supabase/tests/store-form-pdf-check.mjs` | 5/5 | finalisation serveur, refus d'un faux PDF, refus d'une session révoquée et nettoyage direct ou mis en file après échec d'approbation |
| `node --test supabase/tests/store-document-check.mjs` | 8/8 | finalisation catalogue, signature PDF/DOCX côté serveur, refus des macros, relations externes, traversal, legacy OLE et faux DOCX, rôle contributeur et nettoyage mis en file |
| `node --test supabase/tests/email-functions-check.mjs` | 6/6 | les trois fonctions email refusent une session révoquée avant traitement du payload et atteignent le contrôle de soumission avec une session active |
| `node --test supabase/tests/medical-email-server-pdf-check.mjs` | 1/1 | la pièce jointe médicale est générée depuis la ligne propriétaire ; les octets et le nom fournis par l'appelant sont ignorés |
| `node --test supabase/tests/query-bounds-check.mjs` | 2/2 | limites SQL explicites, garde de session conservée et pagination bornée des collections côté client |
| `PGLITE_MODULE=... node --test supabase/tests/query-bounds-sql-check.mjs` | 1/1 | la migration de plafonds se rejoue et remplace les fonctions de collection dans une fixture PostgreSQL |
| `PGLITE_MODULE=... node --test supabase/tests/carpool-lock-order-check.mjs` | 1/1 | la fonction d'annulation de publication verrouille l'ensemble des publications liées dans un ordre déterministe et se rejoue |
| `PGLITE_MODULE=... node --test supabase/tests/global-email-rate-limit-check.mjs` | 1/1 | le coupe-circuit email global refuse le 201e compte synthétique, conserve l'état de la soumission et se rejoue |
| `PGLITE_MODULE=... node --test supabase/tests/document-storage-finalization-check.mjs` | 1/1 | approbation catalogue à usage unique, borne inclusive de 200 objets, triggers de référence/legacy et suppression de la policy d'insert direct |
| `PGLITE_MODULE=... node --test supabase/tests/trainer-level-default-check.mjs` | 1/1 | défaut de qualification vide, qualifications explicites conservées et valeur inconnue refusée |
| `PGLITE_MODULE=... node --test supabase/tests/email-destinations-rls-check.mjs` | 1/1 | membre sans ligne, administrateur lisible via la policy RLS, rejeu de migration |
| `PGLITE_MODULE=... node --test supabase/tests/training-planning-member-view-check.mjs` | 1/1 | membre refusé en mutation directe, contributeur accepté pour le reporting/capacité, rejeu de migration |
| `... node --test supabase/tests/cors-check.mjs` | 1/1 | contrôle statique des six fonctions sensibles ; ce n'est pas un préflight distant |
| `npx esbuild ... --external:npm:*` sur les six fonctions sensibles | réussi pour les six bundles | compilation syntaxique du code Edge et des modules partagés ; les imports `npm:` sont laissés au runtime Deno, donc cela ne prouve ni leur résolution hébergée, ni le déploiement ni l'exécution distante |

La commande combinée des vingt-trois harnais serveur a réussi à 67/67 tests (26 tests
des quatre harnais historiques, puis garde de session des emails, CORS,
finalisations PDF/catalogue avec inspection ZIP Office, limites de réponse, RPC,
cycle de vie Storage, bornes d'entrée, worker de nettoyage, qualifications,
destinataires et planning). Les contrôles hors ligne, PDF, configuration de clés,
publication contributeur, chiffrement du cache et signatures de fichiers sont
inclus dans les 103 tests Vitest.
Les tests PGlite sont des fixtures synthétiques : ils
ne remplacent pas une instance Supabase locale complète.

Docker et `supabase/config.toml` sont absents : aucune instance Supabase locale
complète n'a pu rejouer toutes les migrations, Storage, Auth et Edge Functions.
PGlite et les mocks ne remplacent pas cette validation. La CLI Supabase locale
2.72.7 est ancienne par rapport à la version courante observée ; aucune mise à
jour système n'a été effectuée.

Les trois PDF publics et le DOCX de modèle ont été inspectés statiquement ; la
main courante de modèle a en plus été rendue et relue visuellement. Aucun
formulaire rempli, email/téléphone détecté, JavaScript, action Launch, fichier
embarqué, macro/ActiveX ou relation externe n'a été trouvé dans cette inspection.
Des métadonnées auteur/créateur existent encore dans certaines ressources ; la
canonicalisation PDF avec `pdf-lib` est testée localement sur un PDF synthétique
contenant des actions et annotations actives, mais aucune analyse antivirus ni
test de polyglotte n'a été réalisé. Les paquets Office sont toutefois bornés et
inspectés localement avant approbation ; cela ne constitue pas une preuve
d'innocuité en production.

## Tableau problème → correction → preuve → état

La table détaillée des constats ci-dessus fait foi. Synthèse opérationnelle :

| Problème | Correction | Preuve | État local | État distant |
| --- | --- | --- | --- | --- |
| Autorisations DB/Storage/RPC | migrations additives de durcissement, publication documentaire contributeur, qualification explicite et planning membre en lecture seule | PGlite 5/5 + MFA 10/10 + harnais métier | préparée et testée localement | non appliquée |
| Révocation de session des RPC | garde sur 18 fonctions `SECURITY DEFINER` | `rpc-active-session-check.mjs` 1/1, rejeu | préparée et testée structurellement | non appliquée, E2E distant requis |
| Auth/MFA/comptes | session active, RLS active, réauth, bootstrap sûr, compensation | Vitest/build + tests Edge/PGlite/RLS | corrigé localement, migration à appliquer | réglages/déploiement inconnus |
| Email/PDF | claim atomique, limites, quotas utilisateur et global, session active avant traitement, génération/canonicalisation serveur du PDF médical, finalisation/canonicalisation des PDF de formulaires et du catalogue | PGlite + `email-functions-check.mjs` 6/6 + `global-email-rate-limit-check.mjs` 1/1 + `medical-email-server-pdf-check.mjs` 1/1 + `store-form-pdf-check.mjs` 5/5 + `store-document-check.mjs` 8/8 + tests helper et bundles Edge | génération serveur et finaliseurs testés localement ; AV/historiques et Brevo restent partiels | Edge/Brevo non déployés |
| Cycle de vie Storage | quota par propriétaire, contrôle taille/MIME/objet, queue et worker de purge avec backoff | tests cycle de vie + worker, 8 tests | corrigé et testé localement ; déploiement absent | inventaire/purge/alertes non vérifiés |
| Concurrence covoiturage | verrouillage déterministe de toutes les publications liées avant annulation des correspondances | `carpool-lock-order-check.mjs` 1/1, rejeu SQL | correction additive préparée et testée structurellement | migration non appliquée ; test de concurrence PostgreSQL distant requis |
| Bornes entrées directes | contraintes SQL sur formulaires, PDF et ancien covoiturage | `input-bounds-check.mjs` 1/1 | corrigé pour nouvelles écritures | historiques non validés |
| Hors ligne | liaison au compte, revalidation Auth et `require_active_session` en ligne, purge logout, TTL 24 h et chiffrement AES-GCM par compte des octets et métadonnées | tests lifecycle + chiffrement (`offlineDocuments.test.ts`) | corrigé localement ; révocation pendant un vrai mode hors ligne impossible | navigateur déployé non testé |
| Rôles métier | qualification sans défaut, destinataires admin-only et capacité de planning contributeur | trois harnais PGlite dédiés + Vitest/build | corrigé localement | migrations/RPC distants non appliqués |
| Frontend/hébergement | CSP/headers/HSTS, CORS allowlist, cache SW restreint, erreurs UI génériques | build, scan artefact, `cors-check.mjs` | préparé et testé statiquement | Pages/branche/build vérifiés ; headers production absents avant livraison, CORS runtime à revalider |
| Fichiers actifs | extension, namespace, taille/MIME déclarés, finalisation/canonicalisation serveur des PDF de formulaires et du catalogue, inspection ZIP Office bornée, refus des nouveaux OLE legacy, immutabilité et lien objet-version | `store-form-pdf-check.mjs` 5/5 + `store-document-check.mjs` 8/8 + bundles Edge + inspection statique | partiel : objets historiques sans quarantaine/AV ; aucune analyse antivirus n'est intégrée | scan/quarantaine et inventaire absents |
| Réponses et listes non bornées | pagination et plafonds de collection | `query-bounds-check.mjs` 2/2 + `paginate.test.ts` + build | corrigé localement avec erreur explicite au-delà de 1 000 lignes ; catalogue RPC plafonné à 200 | migration non appliquée ; UX de page catalogue >200 à compléter |

## Séparation explicite des états

1. **Corrections réalisées et validées localement.** Les contrôles listés comme
   « corrigés localement » sont présents dans le checkout et couverts par les
   103 tests Vitest, les 67 tests des harnais PGlite/Node/Edge, le lint, le build et
   les scans d'artefact indiqués ci-dessus. Cela inclut la correction du blocage
   de rejeu de la migration RLS, l'isolation des erreurs UI, la liste CORS, les
   gardes de session des RPC, les bornes SQL, la finalisation serveur des PDF,
   la queue Storage, le worker testable avec secret dédié ou bearer
   service-role strictement serveur, l'inspection ZIP Office et la sélection
   explicite des clés serveur, la qualification explicite, la policy des
   destinataires et le planning membre en lecture seule.
2. **Éléments vérifiés à distance en lecture seule.** Projet Supabase ciblé,
   historique de migrations, RLS/policies/grants/fonctions, buckets et
   compteurs Storage, versions Edge et secrets par nom, état des sauvegardes,
   configuration Pages/variables/previews, réponse HTTPS de production et état
   GitHub ont été observés le 25 septembre 2026. Aucune donnée métier ni
   valeur secrète n'a été exportée.
3. **Actions de production restant à autoriser.** Créer ou confirmer un point
   de restauration ; inventorier les contraintes historiques et les éventuels
   fichiers hors périmètre ; appliquer les 16 migrations ; déployer les trois
   fonctions manquantes et les versions corrigées ; renseigner les trois
   secrets serveur absents ; configurer le scheduler/alertes ; déployer le
   frontend ; exécuter les E2E synthétiques ; puis protéger `main` et vérifier
   l'exécution CI.
4. **Points non vérifiés et décisions métier.** Contenu réel et quarantaine des
   fichiers, réglages fournisseur et quotas Brevo, limites CPU/mémoire et taille
   effective des requêtes Edge, CORS runtime, restauration des sauvegardes,
   chiffrement/rétention/restauration des sauvegardes de journaux et données médicales, support
   navigateur réel du cache chiffré et previews Cloudflare. Ces points ne
   doivent pas être transformés en règles par simple mention de roadmap.

## Vérifications distantes en lecture seule

Les lectures du 25 septembre 2026 sont limitées aux métadonnées et compteurs :

- historique Supabase : 27 versions distantes, dont la version MFA/journal
  `20260917172518`, et 16 migrations locales de durcissement en attente ;
- RLS active sur 18 tables `public`, 26 policies `public`, aucune contrainte
  `NOT VALID` observée ; la policy distante des destinataires autorise encore
  `using true` pour `authenticated` ;
- sept buckets privés, neuf objets au total dans les buckets non vides, zéro
  référence cassée/orphelin/anomalie de namespace/legacy `.doc` ou `.ppt` dans
  l'inventaire sans noms ;
- quatre Edge Functions actives avec `verify_jwt=true`, trois fonctions locales
  absentes à distance, et trois noms de secrets applicatifs manquants ;
- sauvegardes : WALG actif, PITR désactivé, liste de sauvegardes vide ;
- Cloudflare Pages : dépôt GitHub relié, production `main`, build `npm run
  build`/`dist`, previews restreintes par Access après activation, mais headers
  de sécurité absents de la production observée avant livraison ;
- GitHub : branche `main` non protégée et aucun workflow distant au moment du
  contrôle ; le workflow local doit encore être poussé et exécuté.

Ces résultats ne constituent pas une preuve d'intégrité des contenus de fichiers,
de conformité Brevo, de réglage Auth complet ou de restauration. Toute valeur de
secret a été exclue des sorties ; seuls les noms et empreintes non réversibles
ont été utilisés lorsque l'outil les fournissait.

## Déploiement et retour arrière à autoriser

Le déroulé détaillé, les responsables, les critères d’acceptation et le retour
arrière sont centralisés dans
[`SECURITY_REMEDIATION_PLAN_2026-09-20.md`](./SECURITY_REMEDIATION_PLAN_2026-09-20.md).

1. Créer un backup vérifié et exporter les policies, grants, fonctions, buckets,
   réglages Auth et Edge déployés. Tester la restauration sur un environnement
   non productif.
2. Rejouer **toutes** les migrations sur une instance Supabase de test complète.
   Inventorier les lignes historiques violant les contraintes `NOT VALID`, puis
   les corriger et valider explicitement les contraintes.
3. Préparer un administrateur de secours TOTP, la procédure de récupération et
   le provisionnement initial explicite (le premier inscrit n'est plus promu).
4. Appliquer les migrations dans l'ordre, dont
   `20260918015321_security_audit_hardening.sql` puis
   `20260919090000_active_session_rls.sql`,
   `20260919130000_rpc_active_session_hardening.sql`,
   `20260919140000_storage_lifecycle_hardening.sql`,
   `20260919150000_input_bounds_hardening.sql`,
   `20260919160000_storage_cleanup_worker.sql`,
   `20260919170000_form_pdf_server_finalization.sql`,
   `20260919180000_document_server_finalization.sql`,
   `20260919180022_block_legacy_office_uploads.sql` puis
   `20260919190000_query_response_bounds.sql` puis
   `20260919190100_carpool_lock_order_hardening.sql`,
   `20260919190200_global_form_email_rate_limit.sql`,
   `20260919200000_document_contributor_publish.sql`,
   `20260920064930_remove_default_trainer_qualification.sql`,
   `20260920064931_restrict_email_destinations.sql` et
   `20260920065639_training_planning_member_view_only.sql`. Vérifier grants, RLS,
   fonctions, schémas exposés, GraphQL/Realtime et caractère privé des
   buckets. Les contraintes `NOT VALID` doivent faire l'objet d'un inventaire
   puis d'une validation planifiée avant de les déclarer historiques conformes.
5. Déployer les six Edge Functions (`admin-users`, `medical-follow-up-email`,
   `main-courante-email`, `equipment-repair-email`, `store-form-pdf` et
   `store-document`) avec les
   secrets serveur, une valeur `APP_ALLOWED_ORIGINS` exacte pour CORS et une valeur
   `APP_ALLOWED_REDIRECT_ORIGINS` exacte pour les redirections d'invitation.
   Ne pas envoyer d'email réel pendant le smoke test sans autorisation
   distincte.
6. Déployer le frontend et vérifier que Cloudflare applique `_headers` au
   domaine et aux previews ; protéger ou désactiver les previews publiques.
7. Exécuter les E2E synthétiques : deux propriétaires, rôles cumulatifs, AAL1,
   AAL2 TOTP, facteur supprimé, session révoquée, appels REST/RPC/Storage
   directs, cache après logout, concurrence d'inscription et d'email.
8. Déployer séparément `supabase/functions/storage-cleanup-worker` avec
   `STORAGE_CLEANUP_WORKER_SECRET`, la clé service-role uniquement côté Edge,
   un scheduler et des alertes. Le scheduler peut envoyer le secret dédié dans
   `x-storage-cleanup-token` (avec une configuration `verify_jwt` adaptée) ou le
   bearer service-role afin de conserver la vérification JWT native ; dans les
   deux cas, aucune clé ne doit être exposée au frontend.
   Le worker applique retries/backoff et relecture d'une référence avant
   suppression ; ne traiter aucune file historique avant inventaire et
   approbation métier.
9. Activer/contrôler logs, alertes, quotas, sauvegardes et conservation ; suivre
   erreurs 403/409, emails, Storage orphelin et audits administrateurs.

Retour arrière : redéployer les versions frontend/Edge précédentes si nécessaire
et préparer une **nouvelle migration compensatoire** ciblée ; ne pas réécrire
l'historique ni supprimer la migration appliquée. Ne pas restaurer le bootstrap
du premier administrateur, l'UPDATE Storage ou le contournement MFA. En cas de
blocage admin, utiliser l'opérateur Supabase habilité et la procédure hors bande,
pas une désactivation du contrôle. Les objets `sending` peuvent être remis en
`failed` après vérification fournisseur et délai de dix minutes.

## Bilan

Des vulnérabilités d'autorisation, de confidentialité, de révocation de session,
de rejeu email, de bornes d'entrée, d'erreurs trop détaillées et de cache privé
étaient réellement présentes dans le code. Des correctifs locaux sont
maintenant préparés et testés, y compris les gardes des RPC, les contraintes
résiduelles, la qualification explicite, les destinataires admin-only, le
planning membre en lecture seule, le cache chiffré et la queue Storage. Aucun
correctif n'est actif en production tant que migrations, Edge Functions, worker
de purge et frontend ne sont pas déployés puis vérifiés. L'analyse des
octets/quarantaine, la réconciliation des quotas et orphelins Storage, la
validation historique des contraintes et l'exploitation restent ouverts. Ce bilan ne
fournit aucune garantie d'absence totale de vulnérabilités.
