# Comptes et sauvegarde

## Comptes (e-mail + mot de passe)
- Au premier lancement : **Créer mon compte** (e-mail + mot de passe, une seule fois). Ensuite : **Me connecter**.
- **Rester connecté sur cet appareil** (coché par défaut) : on n'a plus rien à retaper à chaque ouverture. Se déconnecter se fait dans Réglages → Mon compte.
- Plusieurs personnes peuvent avoir chacune leur compte sur le même appareil : leurs données sont séparées.
- Le premier compte créé reprend les données déjà présentes sur le téléphone : rien n'est perdu.

**Limites à connaître** (tout est local, il n'y a aucun serveur) :
- Les comptes et les données restent **sur l'appareil**. Un compte créé sur un téléphone n'existe pas sur un autre : pour changer de téléphone, utilise le fichier de sauvegarde.
- Un mot de passe oublié **ne peut pas être récupéré par e-mail**. Solution : créer un nouveau compte puis restaurer un fichier de sauvegarde.
- Le mot de passe protège l'ouverture de l'app. Il n'est jamais enregistré en clair (seulement une empreinte PBKDF2-SHA256 avec sel).

## Sauvegarde
- **Automatique** : l'app enregistre tout sur l'appareil à chaque saisie, et garde une copie par jour pendant 14 jours (Réglages → Mon compte → « Revenir à une copie automatique »).
- **Fichier JSON** : Réglages → **Enregistrer un fichier de sauvegarde**. Sur iPhone, choisis « Enregistrer dans Fichiers » → **iCloud Drive** : il te suit même si tu changes de téléphone. L'accueil te le rappelle après 7 jours sans fichier.
- **Restaurer** : Réglages → **Restaurer depuis un fichier**. Les données du fichier sont **fusionnées** avec celles du compte (rien n'est perdu).
