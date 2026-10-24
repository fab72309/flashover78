# Flashover78 0.19.1-alpha — correctifs de sécurité

Publication autorisée explicitement par l'utilisateur le 24 octobre 2026.
Incrément patch de 0.19.0-alpha : corrections de comportements existants,
aucune nouvelle fonctionnalité métier. Source unique de version package.json,
lockfile synchronisé et affichage via useAppVersion.

## Périmètre livré

- Conservation des fiches médicales, mains courantes, réparations et attributions
  des journaux lors d'une suppression de compte : refus Edge et six FK RESTRICT.
- Bypass de développement désactivé dans tous les builds, même sous NODE_ENV=development.
- Cache documentaire : échéance chiffrée individuelle <24h, recontrôles compte,
  expiration et session, URLs Blob révoquées au changement de compte ; parcours
  de détail hors ligne sans appels RPC/URL signée. Anciennes sélections locales
  invalidées à la mise à jour ; documents à sélectionner de nouveau.
- Refus des contenus ODT actifs/externes, y compris préfixes XML Unicode.
- Lecture bornée des corps JSON des six Edge et refus des entrées non objet.
- Limites finales de 200 documents catalogue / 50 PDF correctement inclusives,
  sans changer les budgets en octets ni les droits de publication.
- Typage Deno corrigé dans les helpers Supabase et narrowing PDFDict explicite ;
  rôle/MFA/session restent contrôlés avant les opérations privilégiées.

## Supabase réellement appliqué et vérifié

Le 24 octobre 2026, contrôle SQL après application à 18:23:31 UTC :

- `20261024162125_security_preserve_retained_records` appliquée ; les six clés
  étrangères ciblées sont validées et ON DELETE RESTRICT.
- `20261024162243_security_upload_quota_boundaries` appliquée ; bornes inclusives
  relues dans les fonctions, EXECUTE réservé au serveur.
- Compteurs agrégés des six tables conservées identiques avant/après ; aucune
  suppression de ligne par les migrations, aucun contenu personnel exporté.
- Six Edge déployées : admin-users v10, medical-follow-up-email v9,
  main-courante-email v6, equipment-repair-email v6, store-form-pdf v2,
  store-document v3. verify_jwt=true pour chacune. Les 15 fichiers sources
  distincts de leurs paquets publiés correspondent octet pour octet au local.
- Worker de nettoyage inchangé, aucune purge ni activation de scheduler,
  aucun email envoyé, aucun secret tourné ou abonnement modifié.

Réconciliation de sources : la migration sections brûlage a été renommée
`20261024151827_brulage_document_sections.sql` pour correspondre à l'historique
distant ; SQL identique, sans nouvelle exécution. La correction préexistante
active_session_rls aligne aussi la source sur les gardes déjà présentes dans
les statements distants ; aucune réexécution. Le dry-run n'annonçait que les
deux nouvelles migrations de conservation et quotas. Aucun repair distant.

## Vérifications de publication

- Installation isolée conforme au lock : npm ci ; npm run check réussi,
  126 tests applicatifs dans 28 fichiers, lint et build réussis.
- 87 tests serveur/SQL/build synthétiques ; vrais SQL sur fixtures PGlite,
  transports Auth/Storage/Brevo et navigateur simulés selon harnais.
- deno check des six handlers réussi ; tests PDF et autorisation relus et
  reproduits indépendamment après la correction de typage.
- Audit npm production : zéro avis ; trois avis modérés persistent dans les
  outils de build. Aucun npm audit fix --force ni upgrade majeur.
- Version 0.19.1-alpha présente dans les assets compilés. Revue indépendante
  de publication sans nouveau blocage de code ; phrase CORS historique corrigée.

Le site est publié par fusion d'une PR dans main, puis par Cloudflare Pages.
Le check Cloudflare du commit de fusion, les assets servis et l'affichage public
de 0.19.1-alpha constituent les contrôles de release à distinguer d'une recette
métier authentifiée. Un HTTP 200 seul n'en tient pas lieu.

## Limites conservées et retour arrière

Aucun test de restauration ni sauvegarde exploitable démontrés ; aucune
sauvegarde lancée pendant cette publication. Pas d'E2E Supabase avec comptes
synthétiques distants ni de vraie coupure réseau/PWA multi-onglets testée.
Quarantaine/antivirus, inventaire historique et course Storage suspectée restent
ouverts. Aucun « tout sécurisé » ni fonctionnement métier complet en production
n'est déduit du build, des métadonnées ou de la disponibilité de la page publique.

En cas de problème, revenir à un artefact frontend ou paquet Edge antérieur
identifié et approuvé ; ce retour peut réintroduire les défauts corrigés. Les
sources Edge précédentes ont été conservées localement hors dépôt pour préparer
un retour contrôlé. Conserver les protections RESTRICT et préférer une correction
SQL additive. Aucune restauration de données ni reconstruction des anciens
caches locaux n'est garantie.

Les rapports SECURITY_AUDIT/MAP/REVIEW_2026-10-24 et les preuves de l'audit sont
des instantanés **antérieurs à cette publication**. Leurs mentions «non publié»,
«CASCADE distant» et l'ancien écart d'identifiant décrivent cet état initial.
Cette note ajoute les opérations réellement effectuées ci-dessus et conserve
leurs risques non résolus.
