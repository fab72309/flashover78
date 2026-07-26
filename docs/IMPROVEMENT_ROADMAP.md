# Feuille de route Flashover78

Cette feuille de route ordonne les améliorations par dépendances et par niveau de risque.
Les migrations Supabase restent la source de vérité pour la base de données.

## Lot 1 - Socle sécurisé et fiable

Statut : réalisé le 24 juillet 2026.

- Rôles administrateur déterminés par la base, sans confiance accordée au navigateur.
- Profil privé séparé de l'annuaire visible par les utilisateurs connectés.
- Coordonnées de covoiturage limitées au conducteur et aux demandes acceptées.
- Acceptation, refus et annulation des demandes traités de façon transactionnelle.
- Documents placés dans des compartiments privés avec liens temporaires.
- Formats autorisés et taille maximale de 20 Mo imposés côté base et interface.
- Tables News supprimées et ancien compartiment News rendu privé et inaccessible.
- Droits anonymes retirés des tables applicatives et des fonctions sensibles.
- Dépendances de production mises à jour.
- Compilation TypeScript réelle, lint et premiers tests automatisés.
- Injection HTML au démarrage supprimée et cache hors ligne corrigé.

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

Statut : réalisé le 26 juillet 2026.

- Capacité maximale par session, modifiable par un responsable.
- Inscription, désinscription et liste d'attente avec promotion automatique.
- Attribution des places traitée sous verrou pour empêcher les surinscriptions.
- Validation de présence par un responsable.
- Vue administrateur nominative avec coordonnées protégées et export CSV.
- Historique individuel des inscriptions et présences depuis le compte.
- Journal d'audit des inscriptions, annulations, promotions, présences et capacités.
- Annulation bloquée après le début de la session.

Critères d'acceptation :

- aucune surinscription possible, même avec des demandes simultanées ;
- coordonnées visibles uniquement par les responsables autorisés ;
- toutes les modifications sensibles sont historisées.

Critères validés par les fonctions transactionnelles, les règles RLS et les
contrôles de schéma Supabase.

## Lot 4 - Documents avancés

Statut : réalisé.

- Métadonnées : catégorie, tags, version, auteur, date d'effet et date d'expiration.
- Recherche plein texte et filtres.
- Favoris personnels.
- Remplacement d'une version sans casser les liens existants.
- Signalement des documents arrivant à expiration.
- Consultation hors ligne des documents explicitement sélectionnés.

Le catalogue unifié conserve une adresse stable pour chaque document, expose
l'historique de ses versions et réserve la publication aux administrateurs.
Les fichiers privés sont ouverts par des liens temporaires et les préférences
personnelles sont protégées par les règles RLS Supabase.

## Lot 5 - Rôles et administration

Statut : planifié.

- Rôles `administrateur`, `formateur` et `utilisateur`.
- Invitations contrôlées et désactivation d'un compte.
- Journal d'audit des actions sensibles.
- Authentification multifacteur obligatoire pour les administrateurs.
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
