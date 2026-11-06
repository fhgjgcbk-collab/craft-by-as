# Activer l’administration du portfolio

L’administration utilise Supabase pour la connexion, les contenus et les images. Sans configuration Supabase, le portfolio continue d’afficher son contenu HTML actuel et l’administration indique les étapes de configuration.

## 1. Créer le projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com/).
2. Dans **SQL Editor**, exécutez le contenu de `supabase-schema.sql`.
3. Dans les réglages d’authentification, désactivez les inscriptions publiques. Dans **Authentication → Users**, créez votre compte avec votre adresse e-mail et un mot de passe. La page d’administration ne permet pas l’inscription.
4. Copiez l’UUID de cet utilisateur. Dans le SQL Editor, exécutez en remplaçant l’UUID :

   ```sql
   insert into public.portfolio_admins (user_id)
   values ('UUID-DE-VOTRE-UTILISATEUR');
   ```

   Cette étape accorde les droits d’administration uniquement à cet utilisateur.

## 2. Connecter le site

Dans les réglages **Project Settings → API** de Supabase, copiez l’URL du projet et la clé publique `anon`/`publishable`. Renseignez-les dans `supabase-config.js` :

```js
export const SUPABASE_URL = "https://votre-projet.supabase.co";
export const SUPABASE_ANON_KEY = "votre-cle-publique";
```

La clé publique est destinée au navigateur ; les règles RLS du schéma protègent les écritures. **Ne placez jamais une clé `service_role` dans les fichiers du site.**

## 3. Utiliser l’administration

Publiez ensemble les fichiers du site, puis ouvrez `admin.html` sur le même domaine. Pour tester en local, servez le dossier avec une extension de serveur local (par exemple Live Server) plutôt que d’ouvrir les fichiers directement. Connectez-vous avec le compte créé dans Supabase. L’administration permet de modifier le profil et sa photo, gérer le parcours, et créer/modifier/supprimer les projets et créations avec plusieurs images.

Les images acceptées sont JPEG, PNG, WebP et GIF, avec une limite de 5 Mo par image. Les contenus enregistrés sont visibles sur le portfolio public.
