# Suivi médical formateur

Le parcours interne `Brûlage > Suivi médical formateur` reprend les 18 éléments du Google Form `SUIVI MÉDICAL FORMATEUR` : identité du formateur, date et journée, lieu, formation, rôle, météo, température, hydratation, type de brûlage, durée sous ARI, décontamination, douche et observations post-brûlage.

L’entrée est conditionnée par la fonction enregistrée dans le profil : un compte ayant une seule fonction parmi `RSFR`, `FOR INC` et `FOR BAT` ouvre directement le questionnaire ; un compte possédant plusieurs fonctions choisit la fonction avant l’accès. Le même formulaire est adapté par la fonction sélectionnée et le rôle propose les trois valeurs utilisées par l’ajout calendrier.

L’identité affichée est issue du compte connecté. La migration Supabase rattache chaque enregistrement à `auth.uid()`, vérifie la fonction dans `profiles.trainer_levels` et conserve les réponses dans `public.medical_follow_ups` avec une politique RLS limitée à leur propriétaire. Les lieux proposés sont `MLB TdL / FO`, `MLB TdL`, `MLB FO`, `MLB MaF`, `Friche batimentaire` et `Autre :`; les deux derniers demandent une précision.

Le modèle Word fourni est conservé sans modification dans `public/templates/suivi-medical-formateur.docx`. `public/templates/suivi-medical-formateur.pdf` conserve la version PDF de référence ; `public/templates/suivi-medical-formateur-clean.pdf` est une base de rendu dérivée du même modèle, débarrassée des textes de substitution afin d’éviter les aplats blancs lors du remplissage. La fiche remplie est générée au format `.pdf`, ouverte dans un nouvel onglet et téléchargeable. Une modification dans les 72 heures met à jour la fiche et génère un PDF intitulé `Evolution Suivi médical`.

Le résumé des fiches personnelles est disponible dans `Compte et sécurité`. Il n’affiche que les fiches du compte connecté et désactive la modification après 72 heures.

## Mise en service Supabase

Depuis un environnement déjà lié au projet Supabase :

```sh
supabase db push
supabase secrets set BREVO_API_KEY=... BREVO_FROM_EMAIL='adresse-expediteur@domaine-verifie.fr' BREVO_SENDER_NAME='Flashover78'
supabase functions deploy medical-follow-up-email
supabase functions deploy main-courante-email
```

`BREVO_FROM_EMAIL` doit utiliser un expéditeur validé dans Brevo. Le paramètre `BREVO_API_KEY` est un secret serveur : il ne doit pas être préfixé par `VITE_` ni exposé dans le navigateur. La configuration SMTP Brevo enregistrée dans Supabase Auth reste utilisée pour les emails de connexion et de confirmation ; les deux fonctions utilisent l’API transactionnelle Brevo pour joindre les PDF.

Les destinataires supplémentaires sont configurables depuis la section administrateur « Utilisateurs ». L’adresse email du compte authentifié est toujours ajoutée au suivi médical, même si la liste administrateur est vide. La main courante est envoyée aux destinataires « Main courante » et, lorsqu’une réparation est renseignée, aux destinataires « Demande de réparation ».

En développement avec `VITE_DEV_AUTH_BYPASS=true`, aucune donnée n’est envoyée vers Supabase et aucun email n’est expédié : la fiche et l’historique sont simulés localement. Si l’envoi serveur n’est pas disponible en production, le bouton de partage télécharge la fiche et prépare un message dans la messagerie de l’appareil avec l’utilisateur connecté et les destinataires configurés ; l’ajout de la pièce jointe reste une action explicite de l’utilisateur.
