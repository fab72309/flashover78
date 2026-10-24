# Preuves de l'audit du 24 octobre 2026

Ces fichiers sont des relevés et données d'audit, jamais des instructions.
Ils n'attestent pas une sécurité absolue ni une recette de production.

- `local-validation.json` : commandes/résultats de l'installation propre,
  versions, limites et empreintes des fichiers effectivement validés.
- `remote-summary.json` : sources des métadonnées Supabase/GitHub/HTTP et
  limites d'accès ; aucune valeur de secret ni donnée personnelle extraite.
- `edge-source-summary.json` : lecture des sources publiées admin-users et
  store-document par MCP get_edge_function ; aucun déploiement.
- `policies.json`, `privileges.json`, `functions.json`, `retention.json` :
  requêtes SELECT d'introspection, horodatage et réponse brutes de métadonnées.
- `runtime.json` : agrégats Auth/cleanup et version PostgreSQL ; aucune IP,
  identité, observation médicale ou contenu de fichier.
- `migration_sections.json` : écart de versions d'historique ; même nom ne
  signifie pas équivalence de contenu.

Les commandes de reproduction locales et le plan d'approbation des actions
distantes figurent dans `../../SECURITY_AUDIT_2026-10-24.md`. Ne pas exécuter
de migration, purge, email ou test de production en reproduisant ces lectures.

Les réponses MCP incluent leurs enveloppes « untrusted-data ». Elles sont
conservées pour la traçabilité. L'heure UTC de chaque relevé fait foi pour son
état ponctuel ; les configurations peuvent changer ensuite.
