# Audit des entrées et des sorties — mise à jour du 20 septembre 2026

## Règle de sécurité

Les caractères légitimes (accents, apostrophes, guillemets, `&`, `<`, `>`) restent des données. Les supprimer dans les formulaires endommagerait les comptes rendus et les mots de passe sans remplacer les protections serveur. Les valeurs SQL passent comme paramètres ; les textes HTML sont encodés au moment de leur affichage.

## Inventaire des surfaces

| Surface | Entrées | Chemin de persistance / rendu |
| --- | --- | --- |
| AuthForm, ForgotPassword, ResetPassword | Identité, email, mot de passe | API Supabase Auth ; métadonnées structurées, rendu React |
| AdminUsers | Identité, rôle, qualifications | Fonction admin-users ; API Auth et objets PostgREST, rendu React |
| AdminEmailDestinations, EmailRecipientsField | Listes de destinataires | Fonction admin-users (action update_email_destinations) ; validation email et listes, rendu React |
| AddEventForm, Calendar | Dates, lieux, formation, formateurs, recherche | Objets insert/update PostgREST et recherche locale ; rendu React |
| TrainingSessionDetail | Inscription, présence, capacité, export CSV | RPC nommées avec paramètres ; CSV neutralisé ; rendu React |
| MedicalFollowUp | Identité, mesures, observations, commentaires | Objets insert/update ; PDF généré comme texte ; email avec escapeHtml |
| MainCourante | Session, météo, matériel, observations, réparation | Objet insert ; PDF généré comme texte ; email avec escapeHtml |
| EquipmentRepairRequest | Demandeur, matériel, inventaire, problème | Objet insert ; PDF généré comme texte ; email avec escapeHtml |
| AccountForms | Email, mot de passe actuel, nouveau mot de passe | Réauthentification Supabase puis mise à jour Auth ; rendu React |
| Carpool, CarpoolPostDetail | Offre/besoin, dates, lieux, notes, demandes | RPC de carpoolMobilityService avec paramètres ; rendu React |
| CarpoolTripDetail | Ancien parcours de demande et réponse | RPC avec paramètres ; rendu React |
| Resources, DocumentUploadPanel, DocumentDetail | Fichier, titre, auteur, tags, dates, recherche | Storage et RPC documentaires avec paramètres ; rendu React |
| SearchableFormateurSelect | Recherche d'identité | Filtrage local ; rendu React |
| AdminMfaGate | Enrôlement, challenge et code TOTP | Supabase Auth MFA puis contrôle base/Edge |
| Profil | Nom, prénom, téléphone | RPC `sync_my_profile`; rôle préservé côté serveur |
| Mode hors ligne | Documents privés et métadonnées | Cache Storage avec octets chiffrés AES-GCM, clé non exportable par compte dans IndexedDB, métadonnées liées à l'identité et purgées au changement de compte |
| Appels directs | REST/PostgREST, RPC, Storage et Edge Functions | Contrôles serveur requis indépendamment de React |

## Constats et durcissement

- Aucune utilisation de `dangerouslySetInnerHTML`, `innerHTML` ou `document.write` trouvée dans `src`. Les textes de formulaires sont rendus comme des nœuds React, qui encodent le HTML.
- Les trois fonctions email encodaient déjà les champs issus des formulaires. Elles partagent désormais `supabase/functions/_shared/html.ts`, avec tests contre balises script/image/iframe, attributs d'événement, entités HTML et guillemets. Les retours à la ligne sont transformés en `<br />` seulement après encodage.
- Les insertions, mises à jour, filtres et RPC transmettent des valeurs structurées via supabase-js. Aucune composition de requête SQL à partir de texte de formulaire ni filtre PostgREST `.or(...)` brut n'a été trouvé dans les services audités. Les migrations ne contiennent pas de SQL dynamique `EXECUTE`. Les concaténations présentes construisent des chemins de documents ou le contenu d'un vecteur de recherche, pas une instruction SQL.
- `search_documents` utilise `websearch_to_tsquery('french', normalized_query)` et des comparaisons avec paramètres dans une requête fixe. Une apostrophe ou une chaîne ressemblant à du SQL n'y devient pas du code.
- Les liens documentaires sont produits par Storage (`createSignedUrl`) ; les aperçus PDF locaux utilisent `URL.createObjectURL`. Le mode démo produit seulement des URL `data:text/plain` encodées. Aucun champ de formulaire n'est utilisé directement comme URL HTML arbitraire dans ces parcours.
- Les exports CSV protègent les opérateurs ASCII et pleine largeur, y compris après caractères de contrôle initiaux ; les guillemets sont doublés et les cellules délimitées. Un essai réel Excel/LibreOffice reste nécessaire, car les interprétations diffèrent.
- Les validateurs email imposent désormais un domaine DNS syntaxiquement borné côté client, fonctions Edge et helper Brevo. Les destinataires des fallback `mailto:` sont filtrés puis percent-encodés ; une adresse ne peut donc pas ajouter `subject`, `body` ou un autre paramètre URI.
- Les liens `mailto:` et `tel:` construits depuis les coordonnées de covoiturage ou de formation encodent également la valeur avant de la placer dans l'URI ; une adresse invalide n'est pas transformée en lien actif.
- La migration de durcissement impose des bornes serveur aux sièges, profils, événements, destinataires et plusieurs champs textuels. Les contraintes `NOT VALID` s'appliquent aux nouvelles écritures sans certifier les lignes historiques ; leur validation distante doit être préparée après inventaire.
- `20260919150000_input_bounds_hardening.sql` complète ces bornes pour les températures et observations médicales, tableaux de formateurs/météo, chemins et tailles des PDF de formulaires et champs du covoiturage legacy. Le harnais `input-bounds-check.mjs` vérifie cinq refus SQL sur données synthétiques.
- Les fonctions email imposent `POST`, bornent le corps même sans en-tête `Content-Length`, revendiquent atomiquement l'envoi, appliquent cinq tentatives par soumission, un quota de vingt revendications par utilisateur et par heure et un coupe-circuit global de 200 revendications par heure pour les trois formulaires (`20260919190200_global_form_email_rate_limit.sql`). Le suivi médical ne reçoit plus de PDF fourni par l'appelant : la fonction relit la ligne propriétaire, génère la pièce jointe serveur et la canonicalise avec `pdf-lib`. Les finaliseurs `store-form-pdf` et `store-document` vérifient les octets, retirent les actions/annotations PDF et enregistrent une approbation à usage unique avant qu'un trigger n'autorise une ligne métier à référencer l'objet. Cela ne constitue pas une analyse antivirus ni une garantie contre les polyglottes.
- Les uploads documentaires sont désormais non écrasants, limités au namespace de l'utilisateur, à 200 objets et 100 Mo par propriétaire ; les extensions, le MIME déclaré et la taille sont contrôlés dans Storage/SQL, et le navigateur refuse les signatures manifestement incohérentes pour PDF/Office/texte avant l'envoi. Les octets passent maintenant par `store-document` côté serveur ; les buckets des formulaires imposent aussi namespace/UUID, MIME PDF et 5 MiB, et leurs écritures authentifiées directes sont désactivées. Un trigger vérifie qu'une version catalogue pointe vers un objet possédé par `uploaded_by` ou vers une approbation serveur à usage unique. Les paquets ODT/DOCX/PPTX passent en plus par une inspection ZIP bornée qui refuse macros, ActiveX, objets embarqués, relations externes, traversal et tailles décompressées excessives. La migration `20260919180022_block_legacy_office_uploads.sql` refuse les nouveaux `.doc`/`.ppt` OLE tant qu'une quarantaine dédiée n'est pas disponible. Une migration RLS séparée exige aussi une session Auth encore active pour les lectures/écritures exposées. L'inventaire des historiques, la quarantaine et l'analyse antivirus des documents catalogue restent à vérifier côté serveur.
- La publication catalogue est alignée sur les rôles cumulatifs : `20260919200000_document_contributor_publish.sql` autorise les contributeurs à créer une ressource et à publier une nouvelle version après finalisation serveur ; la modification des métadonnées et la suppression restent réservées à l'administration.
- La création de profil n'attribue plus `RSFR` implicitement : `20260920064930_remove_default_trainer_qualification.sql` et les normaliseurs frontend/Edge conservent `[]` jusqu'à une attribution administrative explicite. `20260920064931_restrict_email_destinations.sql` empêche les membres de lire les destinataires opérationnels ; `20260920065639_training_planning_member_view_only.sql` réserve les mutations de planning aux contributeurs et administrateurs.
- Les fonctions Edge utilisent désormais une sélection de clé explicite : une variable legacy unique ou une valeur `default` dans le JSON nommé ; une configuration multi-projet sans clé `default` échoue fermement au lieu de choisir arbitrairement la première valeur.
- Les six Edge Functions sensibles utilisent désormais une liste CORS d'origines autorisées avec refus 403 des origines inconnues ; le contrôle local est structurel (`cors-check.mjs`) et ne remplace pas un preflight sur le domaine déployé. Les messages d'erreur de l'interface passent par un normaliseur qui évite d'exposer SQL/PostgREST, URL ou corps fournisseur.
- Les réponses Auth sont normalisées sans énumérer les comptes : une adresse non confirmée ne reçoit plus un message distinct d'un échec de connexion, et les écrans de connexion, récupération et réinitialisation repassent par `getUserFacingError`. Le comportement anti-abus et les messages exacts du fournisseur distant restent à vérifier.
- Les URLs de confirmation et de récupération ne reprennent plus une origine arbitraire de navigateur : l’application utilise le domaine canonique `app.flashover78.com` ou les ports locaux explicitement autorisés, et refuse implicitement les previews inconnues. L’allowlist effectivement configurée dans Supabase reste à vérifier.
- Les collections PostgREST sont maintenant lues par pages de 100, avec un
  plafond de 1 000 lignes et une sonde qui refuse une troncature silencieuse ;
  les RPC de catalogue et de formation imposent également des limites serveur
  (`20260919190000_query_response_bounds.sql`). Le catalogue est défensivement
  limité à 200 lignes par appel ; une UX de curseur reste nécessaire pour un
  volume supérieur.
- La purge Storage ne s'appuie plus uniquement sur le navigateur : `storage-cleanup-worker` réserve une file avec un secret distinct, recontrôle les références, supprime via le client service-role et applique un backoff borné en cas d'échec. Le scheduler, les alertes et l'inventaire historique restent des opérations de production.
- La restitution d'un document mis en cache vérifie désormais, lorsque le navigateur est en ligne, l'identité Auth et la RPC serveur `require_active_session`; une session supprimée côté Auth ne suffit donc plus à conserver le cache si la révocation est observable. En mode réellement hors ligne, aucune révocation distante ne peut être apprise avant l'expiration locale.
- Les octets des documents hors ligne sont chiffrés en AES-GCM avant Cache Storage ; la clé non exportable est liée à l'identifiant de compte dans IndexedDB et supprimée avec la cache à la déconnexion ou au changement de compte. Cette protection ne résiste pas à une XSS active sur le même origin et ne transforme pas le mode hors ligne en preuve de révocation distante.

## Limites de la vérification

Audit du code présent dans le dépôt, sans test d'intrusion du service distant et sans envoi d'email réel. Il ne prouve pas que les migrations et fonctions de production correspondent au dépôt. La validation métier, les limites de taille, l'autorisation/RLS, les fichiers téléchargés et les protections MFA sont des couches distinctes de l'encodage HTML et du paramétrage SQL. Une extension de fichier autorisée ne prouve pas l'innocuité du contenu du fichier. Les tests unitaires du helper ne constituent pas une exécution de bout en bout du fournisseur email.

Toute future sortie HTML doit encoder les textes ; tout futur lien libre doit autoriser explicitement les protocoles attendus. Ne jamais utiliser escapeHtml comme validateur d'URL ou de SQL. Les fonctions SQL futures doivent conserver les paramètres liés et éviter `EXECUTE` avec concaténation d'entrées.

## Surface IA

Non applicable à l'application actuelle. La recherche a couvert `src/`,
`supabase/functions/`, les migrations, les dépendances, la documentation et les
workflows : aucun LLM, chatbot, RAG, embedding, outil agentique ou pipeline IA
n'est présent. Le `tsvector` PostgreSQL est une recherche plein texte classique.

Le mode hors ligne conserve volontairement les documents déjà sélectionnés. La
purge locale couvre déconnexion, changement de compte et une rétention maximale
de 24 heures ; les octets sont chiffrés et la clé est supprimée avec la cache.
Une révocation distante ne peut toutefois pas être connue tant que l'appareil
reste hors ligne pendant cette fenêtre.
