# Audit des entrées et des sorties — 17 septembre 2026

## Règle de sécurité

Les caractères légitimes (accents, apostrophes, guillemets, `&`, `<`, `>`) restent des données. Les supprimer dans les formulaires endommagerait les comptes rendus et les mots de passe sans remplacer les protections serveur. Les valeurs SQL passent comme paramètres ; les textes HTML sont encodés au moment de leur affichage.

## Inventaire des surfaces

| Surface | Entrées | Chemin de persistance / rendu |
| --- | --- | --- |
| AuthForm, ForgotPassword, ResetPassword | Identité, email, mot de passe | API Supabase Auth ; métadonnées structurées, rendu React |
| AdminUsers | Identité, rôle, qualifications | Fonction admin-users ; API Auth et objets PostgREST, rendu React |
| AdminEmailDestinations, EmailRecipientsField | Listes de destinataires | Fonction admin-users (action update_email_destinations) ; validation email et listes, rendu React |
| AddEventForm, Calendar | Dates, lieux, formation, formateurs, recherche | Objets insert/update PostgREST et recherche locale ; rendu React |
| TrainingSessionDetail | Inscription, présence, capacité | RPC nommées avec paramètres ; rendu React |
| MedicalFollowUp | Identité, mesures, observations, commentaires | Objets insert/update ; PDF généré comme texte ; email avec escapeHtml |
| MainCourante | Session, météo, matériel, observations, réparation | Objet insert ; PDF généré comme texte ; email avec escapeHtml |
| EquipmentRepairRequest | Demandeur, matériel, inventaire, problème | Objet insert ; PDF généré comme texte ; email avec escapeHtml |
| AccountForms | Filtres d'historique | Filtres de données ; rendu React |
| Carpool, CarpoolPostDetail | Offre/besoin, dates, lieux, notes, demandes | RPC de carpoolMobilityService avec paramètres ; rendu React |
| CarpoolTripDetail | Ancien parcours de demande et réponse | RPC avec paramètres ; rendu React |
| Resources, DocumentUploadPanel, DocumentDetail | Fichier, titre, auteur, tags, dates, recherche | Storage et RPC documentaires avec paramètres ; rendu React |
| SearchableFormateurSelect | Recherche d'identité | Filtrage local ; rendu React |

## Constats et durcissement

- Aucune utilisation de `dangerouslySetInnerHTML`, `innerHTML` ou `document.write` trouvée dans `src`. Les textes de formulaires sont rendus comme des nœuds React, qui encodent le HTML.
- Les trois fonctions email encodaient déjà les champs issus des formulaires. Elles partagent désormais `supabase/functions/_shared/html.ts`, avec tests contre balises script/image/iframe, attributs d'événement, entités HTML et guillemets. Les retours à la ligne sont transformés en `<br />` seulement après encodage.
- Les insertions, mises à jour, filtres et RPC transmettent des valeurs structurées via supabase-js. Aucune composition de requête SQL à partir de texte de formulaire ni filtre PostgREST `.or(...)` brut n'a été trouvé dans les services audités. Les migrations ne contiennent pas de SQL dynamique `EXECUTE`. Les concaténations présentes construisent des chemins de documents ou le contenu d'un vecteur de recherche, pas une instruction SQL.
- `search_documents` utilise `websearch_to_tsquery('french', normalized_query)` et des comparaisons avec paramètres dans une requête fixe. Une apostrophe ou une chaîne ressemblant à du SQL n'y devient pas du code.
- Les liens documentaires sont produits par Storage (`createSignedUrl`) ; les aperçus PDF locaux utilisent `URL.createObjectURL`. Le mode démo produit seulement des URL `data:text/plain` encodées. Aucun champ de formulaire n'est utilisé directement comme URL HTML arbitraire dans ces parcours.
- Les exports CSV protègent déjà les cellules commençant par des opérateurs de formule ; les guillemets sont doublés et les cellules délimitées.

## Limites de la vérification

Audit du code présent dans le dépôt, sans test d'intrusion du service distant et sans envoi d'email réel. Il ne prouve pas que les migrations et fonctions de production correspondent au dépôt. La validation métier, les limites de taille, l'autorisation/RLS, les fichiers téléchargés et les protections MFA sont des couches distinctes de l'encodage HTML et du paramétrage SQL. Une extension de fichier autorisée ne prouve pas l'innocuité du contenu du fichier. Les tests unitaires du helper ne constituent pas une exécution de bout en bout du fournisseur email.

Toute future sortie HTML doit encoder les textes ; tout futur lien libre doit autoriser explicitement les protocoles attendus. Ne jamais utiliser escapeHtml comme validateur d'URL ou de SQL. Les fonctions SQL futures doivent conserver les paramètres liés et éviter `EXECUTE` avec concaténation d'entrées.
