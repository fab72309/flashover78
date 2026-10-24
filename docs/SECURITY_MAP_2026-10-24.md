# Flashover78 — cartographie et matrice de sécurité

État inspecté le 24 octobre 2026. Cette carte décrit le code et les métadonnées
distantes lues, pas une recette des autorisations en production. Le rapport
`SECURITY_AUDIT_2026-10-24.md` précise les preuves et leurs limites.

## Flux et frontières

| Surface / fichiers propriétaires | Entrée → validation → authentification / autorisation → stockage → restitution |
| --- | --- |
| `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx` | Routes publiques login/forgot/reset ; `/app/*` protégé ; rôle administrateur soumis au gate TOTP dans l'UI. Le serveur décide des droits, indépendamment des routes. |
| `AuthForm`, `AccountForms`, `authRecovery.ts` | Email/mot de passe/identité → validations et URL canonique → Supabase Auth → session localStorage ou sessionStorage → React. Aucun rôle fiable issu des métadonnées utilisateur. |
| `AdminUsers`, `AdminEmailDestinations`, `admin-users` | Action/champs explicitement sélectionnés → corps JSON borné → JWT utilisateur, rôle actuel en base ET RPC MFA → client serveur privilégié → Auth/profiles/destinataires/audit → JSON sans secrets. |
| `Calendar`, `AddEventForm`, `TrainingSessionDetail` | Dates/formation/capacité/présence → bornes → Auth/session + contributeur/admin selon action → events/registrations et RPC transactionnelles → reporting, historique, CSV neutralisé. |
| `MedicalFollowUp`, `medical-follow-up-email` | Qualification explicite et réponses → bornes/trigger propriétaire/72h → `auth.uid()` et RLS → medical_follow_ups → React/PDF aperçu local ; email PDF reconstruit serveur depuis ligne propriétaire. |
| `MainCourante`, `EquipmentRepairRequest`, `store-form-pdf` | Réponses + PDF → borne/signature/canonicalisation serveur → session active → Storage privé + approbation à usage unique → trigger de liaison propriétaire → ligne métier et URL signée. |
| `Resources`, `DocumentUploadPanel`, `DocumentDetail`, `store-document` | Recherche/métadonnées/fichier → signatures/ZIP/XML/PDF/bornes → session/contributeur ; admin pour métadonnées/suppression → RPC resources/resource_versions, Storage privé et approbation → React, historique, URLs signées. |
| `Carpool*`, `carpoolMobilityService.ts` | Offre/besoin/demande/réponse → paramètres RPC/bornes → session, auteur/participant, état métier → verrous ordonnés et tables legacy/nouvelles → contacts restreints et rendu React. |
| `offlineDocuments.ts`, `supabaseService.ts`, `DocumentDetail` | Sélection volontaire → compte/session → AES-GCM → octets Cache Storage, clés non exportables/métadonnées/échéances chiffrées IndexedDB → contrôle propriétaire et TTL individuel <24h avant/après déchiffrement → blob. En ligne : getUser + require_active_session. |
| `public/sw.js`, `public/_headers`, `.github/workflows/security-check.yml` | Shell même origine ; pas de mise en cache des appels Supabase par SW ; headers locaux ; CI npm ci/lint/tests/build/audit et harnais synthétiques. Hébergement réel vérifié seulement par métadonnées HTTP ordinaires et GitHub. |
| `storage-cleanup-worker` | Secret serveur/scheduler → réservation SQL + recontrôle références → suppression Storage + retry/backoff → compteurs. Course entre recontrôle et suppression non exclue ; scheduler externe non vérifié. |
| Brevo | Trois fonctions email → destinataires serveur/Auth → revendication SQL atomique (20/utilisateur/h, 200/global/h, cinq tentatives/fiche) → API transactionnelle. Quotas fournisseur, alertes et délivrabilité non vérifiés. |

## Inventaire persistant et accès directs

- Tables publiques : profiles, profile_directory, events, training_registrations,
  training_audit_log, email_destinations, medical_follow_ups, main_courantes,
  equipment_repair_requests, resources, resource_versions, document_favorites,
  document_offline_selections, document_audit_log, admin_operation_audit,
  carpool_trips, carpool_requests, carpool_posts, carpool_matches.
- Tables privées : form_email_rate_limits, form_email_global_rate_limit,
  storage_cleanup_queue, form_pdf_upload_approvals, document_upload_approvals.
  Absence de RLS sur ces tables internes : vérifier aussi grants et exposition
  du schéma ; ne pas confondre avec accès REST public. `private` n'est pas
  exposé dans la configuration locale ; l'exposition runtime reste à confirmer
  via le plan de contrôle Supabase (setting SQL retourné vide/null).
- Schémas locaux API : public, graphql_public. Toutes les tables publiques
  observées à distance ont RLS. Policies, WITH CHECK, grants, vues et fonctions
  effectives : `security-evidence/2026-10-24/{policies,privileges,functions}.json`.
  Les définitions de fonctions incluent les RPC, helpers et fonctions trigger.
  Aucune vue applicative publique n'a été identifiée dans la lecture locale.
- Buckets : news-images, sdis78-documents, lectures-documents,
  brulage-documents, resources, main-courantes, equipment-repair-requests.
  Les sept sont privés au relevé distant ; 31 objets au total, aucun contenu
  ni nom d'objet personnel extrait. Catalogue 20 MiB/fichier ; formulaires
  5 MiB/fichier. Budgets objets/octets SQL à distinguer des quotas fournisseur.
- Fonctions Edge : admin-users, medical-follow-up-email, main-courante-email,
  equipment-repair-email, store-form-pdf, store-document, storage-cleanup-worker.
  Les sept ont verify_jwt=true au relevé ; autorisation métier toujours requise.
- Secrets : seuls les noms sont enregistrés dans remote-summary.json. Clés
  privilégiées uniquement serveur. Le scan ciblé de dist n'a détecté aucun JWT
  service_role, sb_secret, clé Brevo ou clé privée ; ce n'est pas une analyse
  exhaustive de secrets ni de tout l'historique Git.

## Matrice acteur × ressource × action

`P` = propriétaire ; `Q` = qualification RSFR/FOR INC/FOR BAT explicitement
attribuée ; session active requise pour les accès serveur authentifiés.
Les droits ci-dessous proviennent du code et des policies lues, sans E2E distant.

| Ressource / action | Anonyme | Membre | Contributeur | Admin AAL1 | Admin AAL2 TOTP vérifié actif | Serveur autorisé |
| --- | --- | --- | --- | --- | --- | --- |
| Annuaire restreint / profil privé | Non | annuaire / P | idem | droits cumulés côté DB ; UI gate | idem + gestion via Edge | champs explicitement autorisés |
| Calendrier consultation | Non | Oui | Oui | DB oui ; UI gate | Oui | selon fonction |
| Planning/capacité/présence | Non | Non | Oui selon RPC | droits contributeur cumulés DB ; UI gate | Oui | selon fonction |
| Coordonnées nominatives formation | Non | Non | Non | Non | Oui | selon fonction |
| Covoiturage mutations | Non | P/participant selon RPC | idem | idem côté DB ; UI gate | idem, contrôle selon action | selon fonction |
| Contacts covoiturage | Non | participant autorisé, demandes acceptées | idem | idem côté DB | idem / admin selon RPC | selon fonction |
| Médical lecture/création/évolution | Non | lecture P ; création/évolution P+Q ; évolution ≤72h | idem | aucun droit médical global | aucun droit médical global | email relit sous JWT/P ; pas lecture libre UI |
| Main courante/réparation | Non | P | P | P côté DB ; UI gate | P | finalisation/email contrôlés |
| Catalogue lecture/favoris/offline | Non | lecture ; préférences P | idem | idem côté DB ; UI gate | idem | worker/finaliseur contrôlés |
| Catalogue création/nouvelle version | Non | Non | Oui | contributeur cumulatif DB ; UI gate | Oui | finaliseur puis RPC autorisée |
| Catalogue métadonnées/suppression | Non | Non | Non | Non | Oui | worker uniquement orphelins |
| email_destinations | Non | Non | Non | Non | Oui | fonctions email/admin seulement |
| Rôles/qualifications/audit admin | Non | Non | Non | Non | Oui, rôle actuel + MFA + session | admin-users vérifie ces trois conditions |
| Suppression compte lié à données conservées | Non | Non | Non | Non | Refus après correctif ; ancien distant vulnérable | FK RESTRICT locale, pas encore appliquée |

Session révoquée avec réseau : refus serveur attendu et cache refusé/purgé si
révocation observable. Coupure réelle : révocation distante inconnue ; seules
les sélections du compte dans la fenêtre locale restent consultables. Aucune
promotion locale de rôle ou de qualification n'est une autorisation serveur.

## Surface IA

Non applicable à l’application actuelle ; périmètre inspecté : code frontend,
Edge Functions, migrations, dépendances, workflows et documentation.
La configuration optionnelle OpenAI du Studio Supabase local n'est pas une
intégration IA de l'application. La recherche tsvector est une recherche texte.
