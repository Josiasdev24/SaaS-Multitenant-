# SaaS Multitenant — gestion scolaire

Application web multi-établissements : un seul code, une seule base Supabase, plusieurs écoles.
L'isolation des données entre écoles est assurée par la base (RLS, `school_id` sur chaque table).

- `supabase/migrations/` : schéma, sécurité (RLS), fonctions — à appliquer dans l'ordre.
- `supabase/tests/isolation.sql` : tests automatiques d'isolation entre écoles.
- `supabase/bootstrap/` : création du premier super-administrateur.
- `.env.example` : variables à définir dans Vercel (jamais de clé secrète dans le dépôt).
