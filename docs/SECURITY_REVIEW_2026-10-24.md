Rapport de l'agent indépendant, archivé par le coordinateur depuis son artefact
local ; le complément final Vite reprend son dernier retour de revue.

# Relecture indépendante — Flashover78 — 24 octobre 2026

Périmètre : lecture seule du dépôt, sans sous-agent ni accès distant. Seul ce rapport temporaire est écrit. Revue du diff `git diff HEAD`, des nouveaux fichiers de sécurité et du rapport DB `/tmp/flashover-db-audit.md`. Les sept fichiers préexistants (5 Markdown historiques, cors.ts, migration active_session_rls) sont distingués des corrections de ce run. Aucun changement préexistant n'a été annulé.

## Conclusion intermédiaire (avant signal de gel final)

Les correctifs retenus ne présentent pas d'élargissement de privilège identifié dans la relecture locale. Une faiblesse du premier correctif ODT a été reproduite indépendamment, signalée et corrigée : les préfixes XML Unicode échappaient à la regex de détection des balises actives. La reprise de ma reproduction refuse désormais les préfixes script, é, 前 et e+accent combiné, et le test passif préserve les textes accentués. Cette conclusion porte sur le contrôle structurel implémenté; elle ne certifie pas l'innocuité générale des fichiers.

## Vérifications des correctifs

- Rétention : six FK remplacées transactionnellement par RESTRICT. Suppression Auth/profil interdite dès qu'une fiche conservée ou attribution d'audit existe; compte inutilisé encore supprimable. Aucun effacement/migration de lignes. Le préflight admin échoue fermé sur erreur ou données conservées. Les FK restent nécessaires aux écritures concurrentes après préflight.
- Quotas : comparaison des deux fonctions extraites avant/après migration additive : seuls les opérateurs `>=50` et `>=200` deviennent `>50` et `>200`. Signatures, SECURITY DEFINER, search_path vide et garde service_role identiques. CREATE OR REPLACE conserve les ACL; les triggers anti-Office legacy subsistent. Les tests rejouent deux fois la nouvelle migration, acceptent 50/200 et refusent 51/201; EXECUTE authenticated catalogue reste false.
- Auth de développement : DEV && !PROD && flag explicite. Ni MODE=test seul ni hostname localhost dans le build ne donnent le bypass. Le mock explicite des tests de planning ne modifie pas le code productif.
- Cache hors ligne : échéance chiffrée par document, écriture indépendante; lecture directe refuse échéance absente, future ou expirée avant exposition; contrôle compte/session et échéance réitéré après déchiffrement; cache ancien invalidé par génération propriétaire v2. Le chemin en ligne garde getUser + require_active_session. L'indisponibilité IndexedDB ne donne pas de fallback en clair.
- Corps Edge : helper partagé lit les chunks jusqu'à une limite réelle d'octets indépendamment de Content-Length, annule le flux au premier dépassement, refuse JSON non objet et UTF-8 invalide. Six handlers l'intègrent après les contrôles d'authentification; pas de service_role exposée au client par cette correction.
- ODT : refus des scripts/objets/listeners/liens externes/DTD/encodages alternatifs; XML Unicode corrigé après revue. DOCX/PPTX gardent les inspections .rels et signatures précédentes. Ce contrôle n'est ni un parseur ODF complet ni une analyse antivirus.
- Migration active_session_rls préexistante : garde d'existence sur policy historique ne recrée aucun chemin UPDATE direct supprimé. Le rôle/accès RPC reste celui prévu.

## Reproductions et tests effectivement exécutés indépendamment

1. `PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/retained-records-check.mjs supabase/tests/request-body-check.mjs supabase/tests/admin-api-check.mjs supabase/tests/store-document-check.mjs` : 27/27 au premier passage (avant ajout des deux tests Unicode).
2. `npx vitest run src/utils/devAuth.test.ts src/services/offlineDocuments.test.ts src/services/supabaseService.training.test.ts` : 24/24.
3. `PGLITE_MODULE=... node --test supabase/tests/document-storage-finalization-check.mjs supabase/tests/storage-lifecycle-check.mjs` : 2/2.
4. `node --test supabase/tests/store-document-check.mjs supabase/tests/store-form-pdf-check.mjs supabase/tests/email-functions-check.mjs supabase/tests/medical-email-server-pdf-check.mjs supabase/tests/cors-check.mjs` : 25/25, dont les deux tests Unicode ajoutés après mon signalement.
5. Reproduction ad hoc avec esbuild du vrai documentSignature.ts, import fflate et zipSync, `content.xml` contenant balise script au namespace ODF avec divers préfixes : premier passage script=false, é=true; après correction script=false, é=false, 前=false, e+accent combiné=false.

Ces tests utilisent les node_modules actuellement installés (Vitest annoncé 4.1.11 malgré package.json 4.1.12); le coordinateur refait une validation dans une installation propre conforme au lock. Les résultats ne constituent donc pas à eux seuls une preuve de reproductibilité `npm ci`.

## Conclusions explicitement contestées / limites

- Les noms des tests évoquant une « genuine network outage » ne constituent qu'une simulation navigator.onLine=false et transports Auth/Cache/IndexedDB simulés. Aucune vraie coupure réseau ni transaction multi-onglet IndexedDB native n'a été reproduite.
- PGlite exécute du PostgreSQL réel dans des schémas/roles/fixtures minimaux. Ce n'est pas une instance Supabase complète ni un rejeu cumulatif de toutes les migrations; aucun E2E REST/RPC/Storage distant à deux comptes ou concurrence réelle n'est démontré.
- Les succès d'Edge dans les harnais reposent sur transports Supabase/Brevo mockés, sans email. Ils ne prouvent ni la configuration du fournisseur ni les autorisations effectives en production.
- L'absence de backup exploitable reste un risque majeur; aucun rollback de données ni restauration prouvés. Le nouveau RESTRICT empêche une perte future par suppression mais ne restaure aucune ligne déjà perdue.
- Le TOCTOU du worker Storage entre recontrôle SQL et suppression Storage reste suspecté, non corrigé/non reproduit par cette revue. Ne pas assimiler recheck à atomicité.
- Les sept fichiers préexistants contiennent des affirmations historiques de déploiement octobre/septembre. Leur présence dans le diff ne prouve aucun état actuel. Le coordinateur revalide les métadonnées distantes séparément; aucune publication actuelle déduite ici.
- CORS : les defaults localhost valent en absence de APP_ALLOWED_ORIGINS dans n'importe quel environnement, pas uniquement DEV. Auth et autorisation restent indépendantes de CORS. Correction documentaire demandée.
- docs/MEDICAL_FOLLOWUP.md mentionne encore « DEV ou localhost » pour le bypass; correction documentaire demandée.

## À clore après gel

Lire les derniers changements documentaires, vérifier leur séparation local/distant/publication, rejouer uniquement les tests dont le code a évolué et confirmer qu'aucun patch non revu ne reste.

## Extension de revue — détail documentaire hors ligne

Le patch de getDocumentById/searchDocuments relit métadonnées du propriétaire courant, refuse session expirée, filtre chaque ressource par échéance et recontrôle identité/owner après lecture. DocumentDetail ne demande plus versions ni URL signées en mode navigator.onLine=false; Blob commun ouverture/téléchargement et attribut download explicite. Test indépendant `npx vitest run src/pages/DocumentDetail.offline.test.tsx src/services/offlineDocuments.test.ts src/utils/devAuth.test.ts` : 27/27.

Constat REV-OFF-02 (moyenne, présent dans le code, signalé au coordinateur) : après affichage déjà réussi du Blob A, un changement direct A→B suivi de getDocumentById(B)=null laisse openUrl/downloadUrl inchangés. Le cleanup des deux URLs dépend uniquement d'une modification d'URL ou du démontage; l'effet utilisateur ne nettoie que !user. L'écran masque le document mais l'ancienne URL Blob conserve sa durée de vie. Le test nouvellement présent couvre seulement la réponse différée avant affichage. Correction demandée : invalider/revoquer URLs dès changement d'identifiant et ajouter scénario Blob déjà affiché puis switch.

Le workflow sécurité inclut maintenant les deux nouveaux harnais request-body et retained-records; aucune permission CI ajoutée.

## Reprise après correction des retours

- REV-OFF-02 corrigé : document/URLs/versions effacés dès nouveau chargement, catch/finally ignorent les anciennes générations. Les deux tests supplémentaires couvrent Blob A déjà affiché puis B introuvable et B en erreur. Rejeu indépendant frontend : 29/29 (DocumentDetail/offline/devAuth).
- Nouveau medical-ownership-window-check relu et exécuté indépendamment : 8/8, y compris le test parent et sept sous-tests. Vraies migrations médicales initiales/édition, extraits has_active_session et politiques médicales; Auth minimal simulé. Deux propriétaires, identités serveur, qualification distincte, owner immuable, avant/à/après 72h, révocation avec JWT inchangé. Le workflow l'inclut désormais.
- MEDICAL_FOLLOWUP a été corrigé pour la règle DEV stricte et la rétention; le nouveau rapport recense la documentation historique CORS inexacte sans modifier les sept fichiers préexistants.
- SECURITY_AUDIT_2026-10-24.md lu intégralement et SECURITY_MAP_2026-10-24.md relu : sept constats, preuves et limitations cohérents avec les patches inspectés. Le rapport énonce clairement l'absence de publication, le besoin d'accords distants distincts et l'impossibilité de promettre un rollback de données sans backup. Les risques ouverts Storage TOCTOU/AV/backup/PWA réelle sont explicites. La matrice doit distinguer lecture médicale P de création/édition P+Q (retour documentaire envoyé).

## Clôture finale après signal de gel du coordinateur

Le signal de gel code/documentation a été reçu. Dernière lecture de local-validation.json : environnement npm ci séparé, 126 tests applicatifs et 86 tests serveur/SQL réussis, zéro avis production, trois avis modérés développement, limites des mocks/absence de Supabase complet et de publication explicitement enregistrées. Vérification indépendante des empreintes : les 26 fichiers sources énumérés correspondent à la fois aux empreintes JSON et aux fichiers de l'installation propre; le lock SHA-256 correspond également. Les compteurs globaux sont les résultats du coordinateur, pas une nouvelle exécution personnelle de toutes ces suites. Mes propres rejouages ciblés sont recensés plus haut.

La matrice a été corrigée : lecture médicale propriétaire P ; qualification Q explicite à la création/évolution et borne d'édition de 72h. Le rapport complet, sa carte et MEDICAL_FOLLOWUP décrivent les correctifs et leurs limites sans assimiler code/tests à production. `git diff --check` reste réussi. Aucune écriture dépôt/service distant par le relecteur; aucun contrôle distant personnel exécuté. Les fichiers de preuve distants ne sont relus que comme résultats du coordinateur, pas comme vérification directe indépendante.

Conclusion finale : pas de nouveau défaut bloquant identifié dans les correctifs locaux gelés après traitement des deux retours Unicode et Blob lifecycle. La revue locale est terminée. Les risques résiduels explicités (backup/restauration, Storage TOCTOU suspecté, fichiers actifs/historique, limites fournisseur, PWA/IDB native et E2E Supabase) restent ouverts. Cette clôture n'autorise ni migration ni déploiement et ne certifie pas la sécurité de production.

## Complément final Vite — revue distincte

Après le premier gel, le coordinateur a reproduit un dernier cas F78-02 : un
vrai bundle sous NODE_ENV=development, flag explicite vrai et mode test exposait
encore le bypass. vite.config.ts force maintenant ce flag à false pour toute
commande build. Le relecteur a relu configuration, harnais et CI, puis exécuté
le vrai bundle en mémoire dans l'installation propre : 1/1 réussi. Son retour
final ne signale aucun nouveau blocage. Les deux nouveaux fichiers et le hash CI
ont été ajoutés au manifeste par le coordinateur. Le compte final des harnais
serveur/SQL/build est 87/87 ; les 126 tests applicatifs restent réussis. Ces
compteurs globaux proviennent du coordinateur ; le relecteur n'a pas refait
personnellement toute la suite. Aucun déploiement ni recette distante.
