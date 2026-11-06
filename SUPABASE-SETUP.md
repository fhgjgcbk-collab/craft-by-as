# Activer l’administration du portfolio

L’administration utilise Supabase pour la connexion, les contenus et les images. Sans configuration Supabase, le portfolio continue d’afficher son contenu HTML actuel et l’administration indique les étapes de configuration.

## 1. Créer le projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com/).
2. Dans **SQL Editor**, exécutez le contenu de `supabase-schema.sql`. Si le site Supabase existe déjà, exécutez à nouveau le fichier mis à jour : il ajoute la table des compétences, les types détaillés de projet et la colonne de lien des réalisations sans remplacer les contenus existants.
3. Dans **Authentication → URL Configuration**, gardez comme **Site URL** `https://craft-by-as.vercel.app` et ajoutez `https://craft-by-as.vercel.app/admin.html?set-password=1` aux **Redirect URLs**.
4. Dans les réglages d’authentification, désactivez les inscriptions publiques. Dans **Authentication → Users**, invitez votre adresse e-mail. Pour une invitation, choisissez `https://craft-by-as.vercel.app/admin.html?set-password=1` comme URL de redirection si Supabase le demande.
5. Copiez l’UUID de l’utilisateur invité. Dans le SQL Editor, exécutez en remplaçant l’UUID :

   ```sql
   insert into public.portfolio_admins (user_id)
   values ('UUID-DE-VOTRE-UTILISATEUR');
   ```

   Cette étape accorde les droits d’administration uniquement à cet utilisateur. Faites-la avant d’accepter l’invitation.

## 2. Connecter le site

Dans les réglages **Project Settings → API** de Supabase, copiez l’URL du projet et la clé publique `anon`/`publishable`. Renseignez-les dans `supabase-config.js` :

```js
export const SUPABASE_URL = "https://votre-projet.supabase.co";
export const SUPABASE_ANON_KEY = "votre-cle-publique";
```

La clé publique est destinée au navigateur ; les règles RLS du schéma protègent les écritures. **Ne placez jamais une clé `service_role` dans les fichiers du site.**

## 3. Utiliser l’administration

Publiez ensemble les fichiers du site, puis ouvrez `admin.html` sur le même domaine. Ouvrez le lien reçu par e-mail : la page `admin.html?set-password=1` vous demande de choisir et confirmer un mot de passe. Le formulaire de connexion propose aussi **Mot de passe oublié ?** pour demander un nouveau lien de réinitialisation. Pour tester en local, ajoutez l’URL complète de redirection locale aux **Redirect URLs** Supabase et servez le dossier avec une extension de serveur local (par exemple Live Server) plutôt que d’ouvrir les fichiers directement.

Après connexion, l’administration permet de modifier le profil et sa photo, remplacer le CV PDF (10 Mo maximum), gérer le parcours et les compétences techniques, et créer/modifier/supprimer les projets et créations. Le CV téléversé est utilisé par les boutons de téléchargement et de consultation du portfolio. Chaque contenu accepte plusieurs images ainsi qu’un lien public vers sa réalisation.

Les images acceptées sont JPEG, PNG, WebP et GIF, avec une limite de 5 Mo par image. Les contenus enregistrés sont visibles sur le portfolio public. Le script SQL crée également le stockage public du CV ; relancez `supabase-schema.sql` pour appliquer l’ajout de la colonne et les règles de stockage.

Les liens Facebook obtenus par **Partager → Copier le lien** sont convertis en permalien avant l’intégration par une fonction Vercel. Pour tester ces liens en local, utilisez `vercel dev` ; l’ouverture directe des fichiers ou un serveur statique simple ne fournit pas cette fonction. Facebook peut toujours refuser l’intégration d’une publication, même publique. Dans ce cas, téléversez le visuel depuis l’administration pour garantir son affichage.
