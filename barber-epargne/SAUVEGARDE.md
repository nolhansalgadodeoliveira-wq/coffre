# Comptes et sauvegarde

## Comptes (e-mail + mot de passe), sur tous tes appareils
- Au premier lancement : **Créer mon compte** (e-mail + mot de passe). Sur un autre appareil : **J'ai déjà un compte**, même e-mail, même mot de passe : tout est retrouvé (journées, objectifs, réglages).
- **Rester connecté sur cet appareil** (coché par défaut) : plus rien à retaper à chaque ouverture.
- L'app enregistre toujours d'abord sur le téléphone (elle marche sans réseau), puis envoie une copie en ligne quelques secondes après chaque modification. À l'ouverture et au retour du réseau, elle récupère ce qui a changé ailleurs. Pour un même jour modifié sur deux appareils, la modification la plus récente gagne.
- **Se déconnecter** envoie d'abord ce qui attend ; sans réseau, l'app prévient avant.
- Les comptes de la version précédente (« sur l'appareil seulement ») sont repris automatiquement : à la première connexion avec le même e-mail et le même mot de passe, le compte est créé en ligne et ses données y sont envoyées.

Les comptes et les données sont gardés dans le projet Supabase de l'app (une ligne par compte, chacun ne peut lire que la sienne). L'adresse du projet et la clé « publishable » sont dans l'app : c'est prévu pour. Ne mets jamais le mot de passe de la base ni une clé secrète dans le code.

**Mot de passe oublié** : sur l'écran de connexion, « Mot de passe oublié ? ». L'app envoie un code à 6 chiffres par e-mail ; on le saisit avec un nouveau mot de passe, et on est connecté (les données sont gardées). Deux réglages dans Supabase, une seule fois :
1. **Authentication → Email Templates → Reset Password** : remplacer le contenu par celui du fichier `supabase/email-mot-de-passe-oublie.html` (il affiche le code `{{ .Token }}` au lieu d'un lien), sujet « Ton code Coffre », puis **Save**.
2. **Pour que tout le monde reçoive l'e-mail** : le service d'e-mails fourni par Supabase n'envoie qu'aux adresses de l'équipe du projet, et très peu par heure. Brancher un service d'envoi gratuit (par exemple Brevo) dans **Authentication → Emails → SMTP Settings**.

## Sauvegardes en plus
- **Copies automatiques** : une copie par jour sur le téléphone, 14 jours (Réglages → « Revenir à une copie automatique »).
- **Fichier JSON** : Réglages → **Enregistrer un fichier de sauvegarde** (sur iPhone : « Enregistrer dans Fichiers »). **Restaurer depuis un fichier** fusionne le fichier avec tes données.

## Réglages du projet Supabase (déjà faits)
- Script `supabase/schema.sql` exécuté (tables, sécurité, droits d'accès).
- Authentication → Sign In / Providers → Email : **Confirm email désactivé** (création de compte instantanée, aucun e-mail envoyé).
