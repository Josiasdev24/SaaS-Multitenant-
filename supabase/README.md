# Base de données multi-école — mode d'emploi

## Appliquer (nouveau projet Supabase VIDE uniquement)
Dans Supabase > SQL Editor, coller et exécuter dans cet ordre, un fichier à la fois :
1. `migrations/20261120000001_core.sql`
2. `migrations/20261120000002a_tables_structure.sql, puis 2b, puis 2c`
3. `migrations/20261120000003_access_functions.sql`
4. `migrations/20261120000004_rls.sql`
5. `migrations/20261120000005_rpc_storage_grants.sql`
6. Créer le compte super-admin (Authentication > Users > Add user), puis `bootstrap/first_super_admin.sql`.

## Réglages Supabase à faire
- Authentication > Providers > Email : **désactiver « Allow new users to sign up »** (les comptes sont créés par le super-admin).
- Ne jamais copier la clé `service_role` dans le code ni dans le dépôt : uniquement dans les variables d'environnement de Vercel.

## Tests
`tests/isolation.sql` (109 vérifications : deux écoles, tous les rôles, RPC, stockage). À lancer sur une base de TEST, jamais sur la base de production.

## Règles de sécurité clés
- Chaque table a `school_id` ; la RLS limite chaque compte aux écoles dont il est membre ; liens entre tables en clés composites (une ligne ne peut pas pointer vers une autre école).
- Le super-admin gère écoles, cycles et membres, mais ne lit aucune donnée d'élève, de note ou de finance.
- Secrétaire : finances seulement si `schools.secretary_can_collect = true` ; ne peut ni modifier le type d'élève ni les régimes ; ne supprime jamais un paiement.
- Directeur : limité à ses cycles (aucun cycle assigné = tous les cycles de l'école), finances en lecture seule.
- Suppression de paiement et d'élève : Fondateur seul (journalisée).
