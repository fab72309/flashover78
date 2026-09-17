# Accès administrateur avec TOTP et journal d’authentification

## Mise en service

Le code et la migration seuls ne prouvent pas une activation en production. Cette livraison locale n’a modifié aucun réglage distant ni exécuté la migration sur le projet hébergé.

1. Vérifier que le fournisseur TOTP est activé dans Supabase Authentication. Prévoir un opérateur habilité ayant accès au projet Supabase avant d’appliquer la migration.
2. Déployer le frontend, les Edge Functions modifiées et la migration `20260917165635_admin_totp_and_auth_audit.sql` selon le processus de publication habituel. L’application de cette migration bloque immédiatement les opérations administrateur sans MFA TOTP.
3. Dans **Authentication → Configuration → Audit Logs**, activer **Write audit logs to the database**. Ce réglage est obligatoire pour alimenter le journal présenté par l’application. Il n’a pas été activé par cette livraison. Une liste vide ne prouve ni une absence de connexions ni une configuration correcte ; vérifier explicitement le réglage et un événement réel après activation.
4. Chaque administrateur associe son application d’authentification, puis saisit un code TOTP valide avant d’accéder aux fonctions administratives. Tester un compte administrateur réel, puis une session AAL1 et un compte membre, sur l’environnement autorisé.

## Contrôle des autorisations

Les politiques et RPC existantes utilisant `private.has_role('admin')` ou `private.is_admin()` exigent désormais simultanément une identité authentifiée, le rôle administrateur en base, un JWT `aal2`, une référence AMR `totp` et un facteur TOTP encore vérifié dans `auth.mfa_factors`. Un facteur téléphone seul ne suffit pas. La suppression du dernier facteur TOTP vérifié fait échouer le contrôle même si un ancien JWT reste AAL2. Les droits cumulatifs membre et contributeur restent accessibles selon le rôle existant.

`public.has_admin_mfa()` est un wrapper `SECURITY INVOKER` qui expose uniquement un booléen MFA, pas un contrôle de rôle. Une Edge Function utilisant une clé privilégiée doit contrôler aussi le rôle actuel et appeler ce RPC avec le JWT de l’utilisateur avant l’opération privilégiée. Les schémas privés ne doivent pas être exposés dans la Data API. Aucune clé privilégiée ni aucun secret TOTP n’est renvoyé par ces RPC.

## Journal des IP

`public.list_admin_auth_events(p_before, p_before_id)` vérifie les droits administrateur et MFA côté base. Elle lit les événements Auth écrits par Supabase ; le navigateur n’envoie et ne déclare aucune adresse IP. La RPC expose seulement l’identifiant, la date, l’identifiant et le nom courant du compte, l’action et l’IP consignée par le service Auth. Une IP absente reste absente. Les métadonnées complètes et secrets ne sont jamais exposés.

La liste concerne **les comptes qui sont administrateurs actuellement**, sur les **90 derniers jours**, avec 100 lignes maximum par page. Pour la page suivante, transmettre ensemble `created_at` et `id` de la dernière ligne comme `p_before` et `p_before_id`. Le second curseur évite de perdre des événements partageant exactement la même date. Une promotion rend visibles les anciens événements du compte dans cette période ; une rétrogradation ou suppression du profil les retire de cette vue. Le nom affiché est le nom courant du profil, pas un instantané historique.

Il s’agit d’un journal d’authentification (connexions, renouvellements, déconnexions, événements MFA disponibles), pas d’un journal de toutes les opérations métier. Il ne garantit pas de recenser chaque tentative de mot de passe incorrecte : les erreurs doivent aussi être examinées dans les logs Auth du projet. Le délai et la disponibilité dépendent du service Auth et de sa configuration. L’IP enregistrée correspond à ce que voit l’infrastructure Auth ; un proxy ou VPN peut masquer l’adresse d’origine. La fenêtre de 90 jours est un filtre de consultation, **pas une purge** de la table Auth ni une politique de conservation automatique.

## Perte du facteur

La récupération nécessite un opérateur habilité sur le projet Supabase, avec une vérification d’identité hors bande. Consigner la demande et l’intervention dans le dispositif interne. Révoquer les sessions du compte via l’administration Auth, puis supprimer seulement son facteur perdu avec l’administration MFA Supabase. Faire réenrôler et vérifier un nouveau TOTP dans l’application. Vérifier que les accès administrateur restent refusés avant cette validation, puis fonctionnent après. Ne pas désactiver le contrôle SQL, accorder temporairement un contournement ni transmettre un secret TOTP par courriel. Un second administrateur disposant de son propre facteur permet d’éviter de dépendre d’un seul compte ; il n’obtient pas pour autant le droit de contourner la récupération d’identité.

## Vérification locale

`supabase/tests/admin-mfa-check.mjs` exécute la migration SQL dans PostgreSQL embarqué PGlite avec des fixtures Auth minimales. Installer la dépendance hors dépôt, puis lancer :

```sh
npm install --prefix /tmp/flashover-mfa-db-test --no-audit --no-fund @electric-sql/pglite@0.5.8
PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/admin-mfa-check.mjs
```

Le contrôle couvre AAL1, AAL2 TOTP, AAL2 téléphone, AMR absent, facteur supprimé/non vérifié, rôles membre/contributeur/anonyme, refus direct de lecture des tables Auth, une politique RLS administrative et la pagination des événements avec filtrage et projection des colonnes. Il ne remplace pas l’exécution de toutes les migrations sur une instance Supabase, les advisors, ni un parcours réel de connexion et de journalisation IP sur le projet hébergé.

Le composant de verrouillage est également exercé sous DOM simulé (Vitest/jsdom), y compris refus de code, erreur serveur, enrôlement explicite et changement de session. Le handler Edge réel peut être testé avec des transports simulés :

```sh
node --test supabase/tests/admin-api-check.mjs
```

Ces six contrôles vérifient notamment qu’aucun client privilégié n’est créé avant la validation du rôle et du TOTP. `npm run check` couvre lint, tests applicatifs et build ; les deux scripts de sécurité serveur ci-dessus sont distincts.

## Sources vérifiées

- [Supabase — MFA TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase — Auth Audit Logs et activation de l’écriture en base](https://supabase.com/docs/guides/auth/audit-logs)
- [Schéma Auth — facteurs MFA](https://github.com/supabase/auth/blob/master/migrations/20221003041349_add_mfa_schema.up.sql)
- [Schéma Auth — colonne IP des audits](https://github.com/supabase/auth/blob/master/migrations/20220614074223_add_ip_address_to_audit_log.postgres.up.sql)
- [Service Auth — champs réellement écrits dans les audits](https://github.com/supabase/auth/blob/master/internal/models/audit_log_entry.go)
