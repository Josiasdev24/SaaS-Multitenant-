-- Fonctions de déclencheurs : inutile (et indésirable) de les exposer en appel direct.
revoke all on function public.handle_new_user()          from public, anon, authenticated;
revoke all on function public.audit_row()                from public, anon, authenticated;
revoke all on function public.primary_score_within_max() from public, anon, authenticated;
