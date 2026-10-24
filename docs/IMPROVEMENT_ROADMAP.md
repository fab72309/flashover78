# Feuille de route Flashover78

Cette feuille de route ordonne les améliorations par dépendances et par niveau de risque.
Les migrations Supabase restent la source de vérité pour la base de données.

## Lot 1 - Socle sécurisé et fiable

Statut : contrôles corrigés localement ; activation et exploitation distantes
non vérifiées.

- Rôles administrateur déterminés par la base, sans confiance accordée au navigateur.
- Profil privé séparé de l'annuaire visible par les utilisateurs connectés.
- Coordonnées de covoiturage : le cloisonnement entre passagers et le filtrage
  des demandes acceptées sont corrigés par la migration locale
  `20260918015321_security_audit_hardening.sql`. Son déploiement reste à prouver.
- Acceptation, refus et annulation des demandes traités de façon transactionnelle.
- Documents placés dans des compartiments privés avec liens temporaires. Les
  documents explicitement conservés hors ligne restent liés au compte, expirent
  après 24 h et sont chiffrés AES-GCM avant Cache Storage ; une révocation ne
  peut pas être apprise durant une coupure réseau réelle.
- Formats autorisés, namespace par utilisateur, quota documentaire de 200 objets
  et 100 Mo, et taille maximale de 20 Mo imposés côté policy/SQL/interface ;
  une queue de nettoyage est préparée, mais l'inventaire historique et le
  worker de purge des orphelins restent à exécuter.
- Tables News supprimées et ancien compartiment News rendu privé et inaccessible.
- Droits anonymes retirés des tables applicatives et des fonctions sensibles.
- Dépendances de production mises à jour.
- Compilation TypeScript réelle, lint et premiers tests automatisés.
- Injection HTML au démarrage supprimée et erreurs de boot rendues génériques.
  Lorsque le navigateur est en ligne, une revalidation Auth distante et une
  vérification de `require_active_session` sont exigées avant la restitution.
  Le comportement du navigateur déployé et la révocation pendant un vrai mode
  hors ligne restent à vérifier en production.

## Lot 2 - Ergonomie opérationnelle

Statut : première tranche réalisée.

- Navigation mobile fixe à quatre entrées et menu complémentaire.
- Libellés de statut en français.
- Messages intégrés pour les succès et erreurs.
- Paramètres inutiles retirés et thème sombre fonctionnel.
- Tableau de bord alimenté par les données existantes.
- Routes chargées à la demande pour accélérer l'ouverture.
- Zoom navigateur rétabli et animations réduites selon la préférence système.

À compléter :

- Uniformiser les confirmations avant les actions destructives.
- Ajouter des squelettes de chargement sur les listes longues.
- Vérifier systématiquement les contrastes et la navigation clavier.
- Ajouter une recherche transversale depuis l'en-tête.

## Lot 3 - Gestion des formations

Statut : implémentation présente ; membres en consultation, contributeurs et
administrateurs responsables du planning/reporting.

- Capacité maximale par session, modifiable par un responsable.
- Les RPC historiques d'inscription/désinscription restent disponibles pour le
  reporting interne, mais `20260920065639_training_planning_member_view_only.sql`
  refuse les mutations directes des membres. La capacité est administrable par
  les contributeurs et administrateurs ; les coordonnées nominatives restent
  réservées aux administrateurs.
- Attribution des places traitée sous verrou pour empêcher les surinscriptions.
- Validation de présence par un responsable.
- Vue administrateur nominative avec coordonnées protégées et export CSV.
- Historique individuel des inscriptions et présences depuis le compte.
- Journal d'audit des inscriptions, annulations, promotions, présences et capacités.
- Annulation bloquée après le début de la session.
- Les annulations de publication de covoiturage verrouillent désormais toutes
  les publications liées dans l'ordre UUID (`20260919190100_carpool_lock_order_hardening.sql`)
  afin d'éviter un deadlock entre annulations concurrentes ; la concurrence
  PostgreSQL complète reste à éprouver sur l'instance autorisée.

Critères d'acceptation :

- aucune surinscription possible, même avec des demandes simultanées ;
- coordonnées visibles uniquement par les responsables autorisés ;
- toutes les modifications sensibles sont historisées.

Ces mécanismes sont présents dans le code et testés partiellement en isolation ;
leur application et leur comportement concurrent réel restent à vérifier sur
une instance Supabase complète autorisée.

## Lot 4 - Documents avancés

Statut : présent et testé localement ; publication, inventaire et exploitation
Storage distants non vérifiés.

- Métadonnées : catégorie, tags, version, auteur, date d'effet et date d'expiration.
- Recherche plein texte et filtres.
- Favoris personnels.
- Remplacement d'une version sans casser les liens existants.
- Signalement des documents arrivant à expiration.
- Consultation hors ligne des documents explicitement sélectionnés.

Le catalogue unifié conserve une adresse stable pour chaque document, expose
l'historique de ses versions et réserve la publication aux contributeurs et
administrateurs selon le modèle cumulatif.
Les fichiers privés sont ouverts par des liens temporaires et les préférences
personnelles sont protégées par les règles RLS Supabase.

La migration additive `20260919200000_document_contributor_publish.sql` aligne
les RPC de création et de nouvelle version sur cette règle : un contributeur
peut publier, tandis que la modification des métadonnées et la suppression
restent des opérations administratives.

Les migrations `20260920064930_remove_default_trainer_qualification.sql` et
`20260920064931_restrict_email_destinations.sql` alignent respectivement la
qualification formateur sans défaut et la confidentialité des destinataires
opérationnels. Les journaux et données médicales doivent rester conservés dans
les sauvegardes ; leur chiffrement, rétention et restauration restent à vérifier
sur l'environnement hébergé.

## Lot 5 - Rôles et administration

Statut : partiellement implémenté localement ; état distant non vérifié.

- Rôles cumulatifs `membre`, `contributeur` et `administrateur`; les fonctions
  `RSFR`, `FOR INC` et `FOR BAT` restent des qualifications distinctes.
- Aucune qualification formateur n'est cochée à la création ; les
  administrateurs peuvent attribuer ou retirer chaque fonction explicitement.
- `email_destinations` est lisible par l'administration AAL2 seulement ; les
  fonctions email utilisent le client serveur et les membres n'en voient pas
  les adresses.
- Invitations et création contrôlées ; la désactivation explicite d'un compte
  reste à concevoir.
- Journal Auth présent et journal métier administrateur ajouté localement ; la
  conservation dans les sauvegardes est décidée, tandis que la durée effective,
  le chiffrement, les habilitations et la restauration restent à vérifier à
  distance.
- MFA TOTP obligatoire dans les contrôles base/Edge administrateurs, avec
  vérification de la session Auth active dans la migration de durcissement.
- Les politiques RLS exposées vérifient également une session Auth encore
  présente via `20260919090000_active_session_rls.sql` ; l'instance complète
  et la compatibilité des tokens historiques restent à vérifier.
- Les 18 RPC `SECURITY DEFINER` utilisés par le frontend vérifient également la
  session Auth active via `20260919130000_rpc_active_session_hardening.sql` ;
  le rejeu structurel est testé localement, mais l'E2E Supabase reste à faire.
- Les bornes complémentaires des formulaires, PDF et ancien covoiturage sont
  préparées par `20260919150000_input_bounds_hardening.sql`. Elles sont `NOT
  VALID` pour préserver l'historique jusqu'à son inventaire.
- La queue Storage possède maintenant un worker Edge à secret dédié, avec
  recontrôle de référence, retries et backoff (`20260919160000_...` et
  `storage-cleanup-worker`). Son scheduler, ses alertes et son déploiement
  restent à autoriser.
- Les PDF de main courante et de réparation passent par `store-form-pdf` et
  une approbation serveur à usage unique avant insertion métier
  (`20260919170000_form_pdf_server_finalization.sql`). Cette validation de
  structure/bytes n'est pas une quarantaine ni une analyse antivirus.
- Le PDF joint par l'email de suivi médical est désormais généré depuis la
  ligne propriétaire relue côté serveur ; le PDF client ne sert qu'à l'aperçu
  local et au partage manuel.
- Les uploads du catalogue passent par `store-document` et une approbation
  serveur à usage unique (`20260919180000_document_server_finalization.sql`) ;
  les PDF sont canonicalisés et les formats Office sont contrôlés par
  signature côté serveur. Les paquets ODT/DOCX/PPTX font aussi l'objet d'une
  inspection ZIP bornée qui refuse macros, ActiveX, objets embarqués, relations
  externes, traversal et tailles décompressées excessives. Cela ne remplace pas
  une quarantaine ou une analyse antivirus. Les nouveaux conteneurs OLE legacy
  `.doc` et `.ppt` sont refusés par `20260919180022_block_legacy_office_uploads.sql`
  tant qu'une analyse dédiée n'est pas disponible ; les objets historiques
  restent à inventorier.
- Les fonctions Edge refusent désormais une configuration JSON de clés sans
  valeur `default` explicite ; aucune clé de projet n'est choisie par ordre
  arbitraire.
- Pagination Auth bornée côté Edge/client, quota email atomique par utilisateur
  et coupe-circuit global de 200 revendications par heure préparés localement
  (`20260919190200_global_form_email_rate_limit.sql`) ; l'exécution distante et
  les seuils fournisseur restent à contrôler.
- Les listes applicatives utilisent des pages de 100 avec un plafond explicite de
  1 000 lignes et les RPC de catalogue/formation ont des limites défensives via
  `20260919190000_query_response_bounds.sql`. Le catalogue au-delà de 200
  ressources nécessite encore une interface de page/cursor avant déploiement.
- Interface d'administration séparée des écrans opérationnels.

## Lot 6 - Calendrier et coordination

Statut : planifié.

- Sessions récurrentes.
- Export et abonnement iCalendar.
- Rappels via le vecteur de communication externe retenu.
- Notifications de changement ou d'annulation d'une session.
- Confirmation de trajet et rappel avant départ.

La fonction News ne sera pas réintroduite. Les communications passeront par une
intégration externe à choisir avant ce lot.

## Lot 7 - Pilotage et exploitation

Statut : planifié.

- Indicateurs de participation, capacité, documents et covoiturage.
- Suivi des erreurs applicatives sans données personnelles inutiles.
- Journal technique et alertes de disponibilité.
- Sauvegarde, restauration et procédure de reprise documentées.
- Revue périodique des règles Supabase et des dépendances.

Un workflow CI local est désormais préparé dans `.github/workflows/security-check.yml`
(permissions minimales, actions épinglées, lint/tests/build, audit npm et
harnais Edge). Son exécution GitHub, les protections de branche, les secrets et
les sauvegardes restent hors du périmètre local tant qu'ils ne sont pas vérifiés
à distance avec autorisation.
