-- À exécuter UNE SEULE FOIS, dans l'éditeur SQL de Supabase, APRÈS avoir créé le compte
-- (Supabase > Authentication > Users > Add user, avec cet e-mail et un mot de passe fort).
insert into public.super_admins (user_id)
select id from auth.users where email = 'othnielhoungbo@gmail.com'
on conflict do nothing;

-- Vérification : doit renvoyer 1 ligne.
select user_id from public.super_admins;
