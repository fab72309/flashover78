# Suivi médical formateur

Le parcours interne `Brûlage > Suivi médical formateur` reprend les 18 éléments du Google Form `SUIVI MÉDICAL FORMATEUR` : identité du formateur, date et journée, lieu, formation, rôle, météo, température, hydratation, type de brûlage, durée sous ARI, décontamination, douche et observations post-brûlage.

L’entrée est conditionnée par la fonction enregistrée dans le profil : un compte ayant une seule fonction parmi `RSFR`, `FOR INC` et `FOR BAT` ouvre directement le questionnaire ; un compte possédant plusieurs fonctions choisit la fonction avant l’accès ; un compte sans qualification n’y accède pas. Aucune fonction n’est cochée par défaut à la création d’un profil : les administrateurs attribuent explicitement les qualifications. Le même formulaire est adapté par la fonction sélectionnée et le rôle propose les trois valeurs utilisées par l’ajout calendrier.

L’identité affichée est issue du compte connecté. La migration Supabase rattache chaque enregistrement à `auth.uid()`, vérifie la fonction dans `profiles.trainer_levels` et conserve les réponses dans `public.medical_follow_ups` avec une politique RLS limitée à leur propriétaire. Les lieux proposés sont `MLB TdL / FO`, `MLB TdL`, `MLB FO`, `MLB MaF`, `Friche batimentaire` et `Autre :`; les deux derniers demandent une précision.

Le modèle Word fourni est conservé sans modification dans `public/templates/suivi-medical-formateur.docx`. `public/templates/suivi-medical-formateur.pdf` conserve la version PDF de référence ; `public/templates/suivi-medical-formateur-clean.pdf` est une base de rendu dérivée du même modèle, débarrassée des textes de substitution afin d’éviter les aplats blancs lors du remplissage. La fiche remplie est générée **dans le navigateur** au format `.pdf`, ouverte dans un nouvel onglet et téléchargeable. Elle n'est pas persistée dans un bucket médical protégé par RLS. Une modification dans les 72 heures met à jour la ligne métier et génère un PDF intitulé `Evolution Suivi médical`.

La fonction email relit la fiche via la session et la propriété RLS de l'appelant,
génère elle-même la pièce jointe à partir de la ligne médicale persistée, puis
la canonicalise côté serveur en retirant les actions, formulaires, annotations
et pièces embarquées avant l'envoi. Elle revendique atomiquement l'envoi
(temporisation, maximum de cinq tentatives par fiche et quota de vingt
revendications par utilisateur et par heure). Le PDF client reste limité à
l'aperçu local et au partage manuel explicite ; il n'est plus accepté comme
pièce jointe de la fonction email. Le finaliseur `store-form-pdf` vérifie
également côté serveur les PDF de main courante et de réparation avant leur
stockage. Ces contrôles ne constituent pas une analyse antivirus ni une
quarantaine : une analyse adaptée reste nécessaire avant de considérer les
fichiers actifs comme pleinement maîtrisés.

Le résumé des fiches personnelles est disponible dans `Compte et sécurité`. Il n’affiche que les fiches du compte connecté et désactive la modification après 72 heures.

Les journaux et données médicales conservés par l’application doivent rester
présents dans les sauvegardes selon la décision métier. La durée de rétention,
le chiffrement des sauvegardes, les personnes habilitées et un test de
restauration isolé restent à vérifier sur l’environnement hébergé ; ce document
ne constitue pas une conclusion réglementaire.

## Mise en service Supabase

Après revue et autorisation explicite, depuis un environnement déjà lié au
projet Supabase :

```sh
supabase db push
supabase secrets set BREVO_API_KEY=... BREVO_FROM_EMAIL='adresse-expediteur@domaine-verifie.fr' BREVO_SENDER_NAME='Flashover78'
supabase functions deploy medical-follow-up-email
supabase functions deploy main-courante-email
supabase functions deploy equipment-repair-email
supabase functions deploy store-form-pdf
```

`BREVO_FROM_EMAIL` doit utiliser un expéditeur validé dans Brevo. Le paramètre `BREVO_API_KEY` est un secret serveur : il ne doit pas être préfixé par `VITE_` ni exposé dans le navigateur. La configuration SMTP Brevo enregistrée dans Supabase Auth reste utilisée pour les emails de connexion et de confirmation ; les fonctions métier utilisent l’API transactionnelle Brevo pour joindre les PDF.

Les destinataires supplémentaires sont configurables depuis la section administrateur « Utilisateurs ». L’adresse email du compte authentifié est toujours ajoutée au suivi médical, même si la liste administrateur est vide. La main courante est envoyée aux destinataires « Main courante » et, lorsqu’une réparation est renseignée, aux destinataires « Demande de réparation ».

En développement, le bypass n'est actif que lorsque le flag est explicite et
que Vite est en mode développement ou sur localhost. Il ne doit jamais être
configuré sur un build de production. Aucune donnée n’est alors envoyée vers
Supabase et aucun email n’est expédié : la fiche et l’historique sont simulés
localement. Si l’envoi serveur n’est pas disponible, le bouton de partage reste
une action explicite de l’utilisateur ; les destinataires de ce partage doivent
être contrôlés séparément de la RLS propriétaire.
