# Rappel de fin de journée (notifications)

Une notification arrive à l'heure choisie (20 h 30 par défaut) **les jours où tu travailles**, seulement si la journée n'est pas encore saisie. Elle part d'un petit programme qui tourne sur le projet Supabase, même quand l'app est fermée.

## 1. Une seule fois, par le propriétaire de l'app (environ 10 minutes)
Dans l'app : **Réglages → Rappel de fin de journée → Configurer les rappels**. L'assistant prépare tout, il n'y a qu'à copier-coller :
1. **Générer tes clés** (un bouton dans l'app).
2. **Préparer la base** : Supabase → **SQL Editor → New query**, coller le script copié dans l'app, **Run**.
3. **Créer la fonction d'envoi** : Supabase → **Edge Functions → Deploy a new function → Via Editor**.
   - Nom : `reminders` (exactement).
   - Coller le code copié dans l'app, puis **Deploy**.
   - Dans les réglages de la fonction (**Details**), **désactiver « Verify JWT with legacy secret »** (ou « Enforce JWT verification »), puis **Save**.
   - **Edge Functions → Secrets** : ajouter les 4 secrets affichés dans l'app (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`).
4. **Vérifier** (bouton dans l'app) : l'app dit exactement ce qui manque.

Ne partage jamais `VAPID_PRIVATE_KEY` ni `CRON_SECRET` : ils ne servent qu'à Supabase. L'app efface la clé privée du téléphone une fois la configuration validée.

## 2. Chaque utilisateur, sur son téléphone
1. **Sur iPhone** : ouvrir l'app dans Safari → **Partager → Sur l'écran d'accueil**, puis toujours l'ouvrir depuis cette icône (iOS 16.4 ou plus récent). Les notifications ne marchent pas dans un onglet Safari.
2. **Réglages → Rappel de fin de journée** : activer, accepter les notifications, choisir l'heure.
3. Bouton **« Tester »** pour vérifier tout de suite.

## Si ça ne marche pas
| Symptôme | Solution |
|---|---|
| « La fonction ne répond pas » | Elle doit s'appeler exactement `reminders`, être déployée, avec « Verify JWT » désactivé. |
| « Secrets manquants » | Ajouter les 4 secrets dans Edge Functions → Secrets, puis relancer « Vérifier ». |
| Pas de notification sur iPhone | Ouvrir l'app depuis l'icône de l'écran d'accueil ; Réglages iPhone → Notifications → Coffre : autorisées. |
| Notification reçue alors que la journée est saisie | La saisie n'était pas encore envoyée en ligne (pas de réseau) : ouvrir l'app une fois suffit. |
