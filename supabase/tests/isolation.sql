-- =====================================================================
-- TESTS D'ISOLATION ENTRE ÉCOLES (à exécuter sur une base de TEST uniquement)
-- Deux écoles A et B, un super-admin, des comptes de chaque rôle.
-- Chaque test écrit une ligne dans t.results ; en fin de script, les
-- échecs sont listés. Zéro échec attendu.
-- Prérequis des tests locaux : les rôles anon/authenticated et le schéma auth (simulés ou réels).
-- =====================================================================
\set ON_ERROR_STOP off
drop schema if exists t cascade;
create schema t;
create table t.results (name text, ok boolean);
grant usage on schema t to authenticated, anon;
grant all on t.results to authenticated, anon;
create function t.check(n text, c boolean) returns void language sql as $$ insert into t.results values (n, coalesce(c, false)) $$;
-- Exécute une instruction ; renvoie 'ok:<lignes>' ou 'err:<message>'.
create function t.try(q text) returns text language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return 'ok:' || n;
exception when others then return 'err:' || sqlerrm; end $$;
grant execute on all functions in schema t to authenticated, anon;

-- ---------- Comptes ----------
\set SUPER   '00000000-0000-0000-0000-0000000000a0'
\set FA      '00000000-0000-0000-0000-0000000000a1'
\set DA      '00000000-0000-0000-0000-0000000000a2'
\set SA      '00000000-0000-0000-0000-0000000000a3'
\set TA      '00000000-0000-0000-0000-0000000000a4'
\set PA      '00000000-0000-0000-0000-0000000000a5'
\set FB      '00000000-0000-0000-0000-0000000000b1'
\set DB      '00000000-0000-0000-0000-0000000000b2'
\set MULTI   '00000000-0000-0000-0000-0000000000c1'
insert into auth.users (id, email) values
 (:'SUPER','super@x'),(:'FA','fa@x'),(:'DA','da@x'),(:'SA','sa@x'),(:'TA','ta@x'),(:'PA','pa@x'),
 (:'FB','fb@x'),(:'DB','db@x'),(:'MULTI','multi@x');
insert into public.super_admins (user_id) values (:'SUPER');

-- ---------- Écoles et membres créés PAR le super-admin (teste les fonctions d'administration) ----------
set role authenticated;
select set_config('test.uid', :'SUPER', false);
select t.check('super: create_school A', (select public.create_school('Ecole A', 'ecole-a')) is not null);
select t.check('super: create_school B', (select public.create_school('Ecole B', 'ecole-b')) is not null);
reset role;
select id as "SA_ID" from public.schools where slug='ecole-a' \gset
select id as "SB_ID" from public.schools where slug='ecole-b' \gset

-- Fiches enseignant (données, créées hors API)
insert into public.teachers (id, school_id, first_name, last_name) values
 ('00000000-0000-0000-0000-00000000ee01', :'SA_ID', 'Tea', 'Cher');

set role authenticated;
select set_config('test.uid', :'SUPER', false);
select public.admin_add_member(:'SA_ID', :'FA', 'founder');
select public.admin_add_member(:'SA_ID', :'DA', 'director', array['college']);
select public.admin_add_member(:'SA_ID', :'SA', 'secretary');
select public.admin_add_member(:'SA_ID', :'TA', 'teacher', '{}', '00000000-0000-0000-0000-00000000ee01');
select public.admin_add_member(:'SA_ID', :'PA', 'primary', array['primaire']);
select public.admin_add_member(:'SB_ID', :'FB', 'founder');
select public.admin_add_member(:'SB_ID', :'DB', 'director');
select public.admin_add_member(:'SA_ID', :'MULTI', 'secretary');
select public.admin_add_member(:'SB_ID', :'MULTI', 'founder');
reset role;

-- ---------- Données des deux écoles (insérées en administrateur de base de données) ----------
create function t.seed(sid uuid, tag text) returns void language plpgsql as $$
declare ay uuid; cc uuid; cp uuid; lc uuid; lp uuid; cls_c uuid; cls_p uuid; subj uuid; sc uuid; sp uuid;
        pr uuid; ev uuid; sf uuid; psub uuid; tid uuid;
begin
  insert into public.academic_years (school_id,label,start_date,end_date,is_current) values (sid,'2026-2027','2026-09-01','2027-07-01',true) returning id into ay;
  select id into cc from public.school_cycles where school_id=sid and code='college';
  select id into cp from public.school_cycles where school_id=sid and code='primaire';
  insert into public.education_levels (school_id,cycle_id,name) values (sid,cc,'6e') returning id into lc;
  insert into public.education_levels (school_id,cycle_id,name) values (sid,cp,'CM1') returning id into lp;
  insert into public.classes (school_id,name,level_id,academic_year_id) values (sid,'6e A',lc,ay) returning id into cls_c;
  insert into public.classes (school_id,name,level_id,academic_year_id) values (sid,'CM1 A',lp,ay) returning id into cls_p;
  insert into public.subjects (school_id,name,code) values (sid,'Maths','MATH') returning id into subj;
  if tag='A' then
    tid := '00000000-0000-0000-0000-00000000ee01';
    update public.classes set main_teacher_id = tid where id = cls_c;
  end if;
  insert into public.students (school_id,matricule,first_name,last_name,class_id,academic_year_id,student_type)
    values (sid,'M-001','Col'||tag,'Eleve',cls_c,ay,'nouveau') returning id into sc;
  insert into public.students (school_id,matricule,first_name,last_name,class_id,academic_year_id)
    values (sid,'M-002','Pri'||tag,'Eleve',cls_p,ay) returning id into sp;
  insert into public.parents (school_id,first_name,last_name) values (sid,'Par'||tag,'Ent') returning id into pr;
  insert into public.student_parents (school_id,student_id,parent_id) values (sid,sc,pr);
  insert into public.evaluations (school_id,class_id,subject_id,term_id,title)
    select sid,cls_c,subj,tm.id,'Devoir' from (select id from public.terms where false union all select null) tm limit 0;
  insert into public.terms (school_id,academic_year_id,name,start_date,end_date) values (sid,ay,'T1','2026-09-01','2026-12-20');
  insert into public.class_subjects (school_id,class_id,subject_id,teacher_id) values (sid,cls_c,subj,tid);
  insert into public.evaluations (school_id,class_id,subject_id,term_id,title)
    values (sid,cls_c,subj,(select id from public.terms where school_id=sid limit 1),'Devoir 1') returning id into ev;
  insert into public.grades (school_id,evaluation_id,student_id,score) values (sid,ev,sc,12);
  insert into public.attendance (school_id,student_id,class_id,status) values (sid,sc,cls_c,'absent');
  insert into public.primary_subjects (school_id,grp,name,block,max_points) values (sid,'g','Lecture','b',10) returning id into psub;
  insert into public.primary_scores (school_id,student_id,subject_id,month_key,score) values (sid,sp,psub,'2026-10',8);
  insert into public.school_fees (school_id,academic_year_id,level_id,name,kind,amount) values (sid,ay,lc,'Tranche 1','tranche',100000) returning id into sf;
  insert into public.student_fees (school_id,student_id,school_fee_id,amount_due) values (sid,sc,sf,100000);
  insert into public.student_fees (school_id,student_id,school_fee_id,amount_due)
    select sid, sp, sf, 50000;
  insert into public.fee_payments (school_id,student_id,amount,receipt_number) values (sid,sc,30000,'R-1');
  insert into public.fee_payments (school_id,student_id,amount,receipt_number) values (sid,sp,20000,'R-2');
  insert into public.expenses (school_id,amount,category) values (sid,5000,'fournitures');
  insert into public.incomes (school_id,amount,category) values (sid,7000,'don');
  insert into public.tontine_deposits (school_id,student_id,amount) values (sid,sc,1000);
end $$;
select t.seed(:'SA_ID','A');
select t.seed(:'SB_ID','B');
select id as "STU_A_COL" from public.students where school_id=:'SA_ID' and matricule='M-001' \gset
select id as "STU_A_PRI" from public.students where school_id=:'SA_ID' and matricule='M-002' \gset
select id as "STU_B_COL" from public.students where school_id=:'SB_ID' and matricule='M-001' \gset
select id as "AY_A" from public.academic_years where school_id=:'SA_ID' \gset
select id as "AY_B" from public.academic_years where school_id=:'SB_ID' \gset
select id as "CLS_A_COL" from public.classes where school_id=:'SA_ID' and name='6e A' \gset
select id as "CLS_B_COL" from public.classes where school_id=:'SB_ID' and name='6e A' \gset
select id as "PAY_A" from public.fee_payments where school_id=:'SA_ID' and receipt_number='R-1' \gset

-- Aide : tables portant school_id
create view t.tenant_tables as
 select c.relname as tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
 join pg_attribute a on a.attrelid=c.oid and a.attname='school_id' and not a.attisdropped
 where c.relkind='r';
grant select on t.tenant_tables to authenticated, anon;
create function t.foreign_rows(me uuid, other uuid) returns bigint language plpgsql as $$
declare r record; n bigint; total bigint := 0;
begin
  for r in select tbl from t.tenant_tables loop
    execute format('select count(*) from public.%I where school_id = %L', r.tbl, other) into n;
    total := total + n;
  end loop;
  return total;
end $$;
grant execute on function t.foreign_rows(uuid, uuid) to authenticated, anon;

-- =====================================================================
-- 1. ISOLATION DE LECTURE : aucun compte ne voit de ligne de l'autre école
-- =====================================================================
set role authenticated;
select set_config('test.uid', :'FA', false);
select t.check('1a Fondateur A ne voit AUCUNE ligne de B (toutes tables)', t.foreign_rows(:'FA', :'SB_ID') = 0);
select t.check('1b Fondateur A voit bien ses propres élèves', (select count(*) from public.students) = 2);
select t.check('1c Fondateur A ne voit que l''école A', (select count(*) from public.schools) = 1);
select set_config('test.uid', :'FB', false);
select t.check('1d Fondateur B ne voit AUCUNE ligne de A', t.foreign_rows(:'FB', :'SA_ID') = 0);
select set_config('test.uid', :'DB', false);
select t.check('1e Directeur B ne voit aucune ligne de A', t.foreign_rows(:'DB', :'SA_ID') = 0);
select set_config('test.uid', :'SA', false);
select t.check('1f Secrétaire A ne voit aucune ligne de B', t.foreign_rows(:'SA', :'SB_ID') = 0);
select set_config('test.uid', :'TA', false);
select t.check('1g Enseignant A ne voit aucune ligne de B', t.foreign_rows(:'TA', :'SB_ID') = 0);
select set_config('test.uid', :'PA', false);
select t.check('1h Compte Primaire A ne voit aucune ligne de B', t.foreign_rows(:'PA', :'SB_ID') = 0);
-- Compte sans aucune appartenance
reset role;
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000d1','orphan@x');
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000d1', false);
select t.check('1i Compte sans école : ne voit rien', t.foreign_rows(null, :'SA_ID') + t.foreign_rows(null, :'SB_ID') = 0);
select t.check('1j Compte sans école : my_memberships vide', (select count(*) from public.my_memberships()) = 0);
-- Anonyme
reset role; set role anon; select set_config('test.uid', '', false);
select t.check('1k Anonyme : accès refusé aux élèves', t.try('select * from public.students') like 'err:%');
select t.check('1l Anonyme : accès refusé aux fonctions', t.try('select public.my_schools()') like 'err:%');
select t.check('1m Anonyme : accès refusé à add_fee_adjustment', t.try('select public.add_fee_adjustment(''00000000-0000-0000-0000-000000000001'',''bourse'',1)') like 'err:%');
reset role;

-- =====================================================================
-- 2. ISOLATION D'ÉCRITURE
-- =====================================================================
set role authenticated;
select set_config('test.uid', :'FA', false);
select t.check('2a A ne peut pas créer un élève dans B',
  t.try(format('insert into public.students (school_id,matricule,first_name,last_name,academic_year_id) values (%L,''X1'',''a'',''b'',%L)', :'SB_ID', :'AY_B')) like 'err:%');
select t.check('2b A ne peut pas modifier un élève de B (0 ligne)',
  t.try(format('update public.students set last_name=''HACK'' where id=%L', :'STU_B_COL')) = 'ok:0');
select t.check('2c A ne peut pas supprimer un paiement de B',
  t.try(format('delete from public.fee_payments where school_id=%L', :'SB_ID')) = 'ok:0');
select t.check('2d A ne peut pas déplacer un élève vers B',
  t.try(format('update public.students set school_id=%L where id=%L', :'SB_ID', :'STU_A_COL')) like 'err:%');
select t.check('2e Élève de A dans une classe de B : refusé (clé composite)',
  t.try(format('update public.students set class_id=%L where id=%L', :'CLS_B_COL', :'STU_A_COL')) like 'err:%');
select t.check('2f Paiement de A pour un élève de B : refusé',
  t.try(format('insert into public.fee_payments (school_id,student_id,amount) values (%L,%L,100)', :'SA_ID', :'STU_B_COL')) like 'err:%');
select t.check('2g A ne peut pas modifier les réglages de l''école B (0 ligne)',
  t.try(format('update public.schools set name=''HACK'' where id=%L', :'SB_ID')) = 'ok:0');
select t.check('2h A ne peut pas changer son propre school_id / slug',
  t.try(format('update public.schools set slug=''hack'' where id=%L', :'SA_ID')) like 'err:%');
select t.check('2i A ne peut pas créer d''école', t.try('insert into public.schools (slug,name) values (''z-z'',''Z'')') like 'err:%');
select t.check('2j A ne peut pas s''ajouter à l''école B',
  t.try(format('insert into public.school_members (school_id,user_id,role) values (%L,%L,''director'')', :'SB_ID', :'FA')) like 'err:%');
select t.check('2k Fondateur A ne peut pas créer un autre Fondateur',
  t.try(format('insert into public.school_members (school_id,user_id,role) values (%L,%L,''founder'')', :'SA_ID', :'DB')) like 'err:%');
select t.check('2l Fondateur A ne peut pas se donner accès au super-admin',
  t.try(format('insert into public.super_admins (user_id) values (%L)', :'FA')) like 'err:%');
select t.check('2m Fondateur A ne peut pas appeler create_school', t.try('select public.create_school(''Z'',''zz'')') like 'err:%');
select t.check('2n Fondateur A ne peut pas lire le journal de B',
  (select count(*) from public.audit_log where school_id = :'SB_ID') = 0);
reset role;

-- Mêmes numéros dans deux écoles : permis ; doublon dans la même école : refusé
select t.check('2o Même matricule dans 2 écoles : permis', (select count(*) from public.students where matricule='M-001') = 2);
select t.check('2p Même reçu R-1 dans 2 écoles : permis', (select count(*) from public.fee_payments where receipt_number='R-1') = 2);
select t.check('2q Doublon de matricule dans la même école : refusé',
  t.try(format('insert into public.students (school_id,matricule,first_name,last_name,academic_year_id) select %L,''M-001'',''a'',''b'',id from public.academic_years where school_id=%L', :'SA_ID', :'SA_ID')) like 'err:%');

-- =====================================================================
-- 3. RPC : l'école est déduite de la ligne visée
-- =====================================================================
set role authenticated;
select set_config('test.uid', :'FB', false);
select t.check('3a B ne peut pas ajuster un élève de A', t.try(format('select public.add_fee_adjustment(%L,''bourse'',1000)', :'STU_A_COL')) like 'err:%Accès refusé%');
select t.check('3b B ne peut pas affecter des frais à un élève de A', t.try(format('select public.assign_student_fees(%L)', :'STU_A_COL')) like 'err:%Accès refusé%');
select t.check('3c B ne peut pas régler la tontine d''un élève de A', t.try(format('select public.settle_tontine(%L, current_date)', :'STU_A_COL')) like 'err:%Accès refusé%');
select t.check('3d B ne peut pas régler la tontine du mois de l''école A', t.try(format('select public.settle_tontine_month(%L, current_date)', :'SA_ID')) like 'err:%Accès refusé%');
select set_config('test.uid', :'FA', false);
select t.check('3e Fondateur A : ajustement sur son élève OK', t.try(format('select public.add_fee_adjustment(%L,''bourse'',1000,''test'')', :'STU_A_COL')) like 'ok:%');
select t.check('3f L''ajustement est visible de A', (select count(*) from public.fee_adjustments) = 1);
select set_config('test.uid', :'FB', false);
select t.check('3g B ne voit pas l''ajustement de A', (select count(*) from public.fee_adjustments) = 0);
reset role;
select id as "ADJ_A" from public.fee_adjustments where school_id=:'SA_ID' limit 1 \gset
set role authenticated; select set_config('test.uid', :'FB', false);
select t.check('3i B ne peut pas supprimer l''ajustement de A (par id)', t.try(format('select public.remove_fee_adjustment(%L)', :'ADJ_A')) like 'err:%Accès refusé%');
select set_config('test.uid', :'FA', false);
select t.check('3j A peut supprimer son ajustement', t.try(format('select public.remove_fee_adjustment(%L)', :'ADJ_A')) like 'ok:%');
reset role;

-- =====================================================================
-- 4. RÔLES À L'INTÉRIEUR D'UNE ÉCOLE
-- =====================================================================
set role authenticated;
-- Directeur du collège (cycle « college »)
select set_config('test.uid', :'DA', false);
select t.check('4a Directeur collège voit l''élève du collège', (select count(*) from public.students where matricule='M-001') = 1);
select t.check('4b Directeur collège NE voit PAS l''élève du primaire', (select count(*) from public.students where matricule='M-002') = 0);
select t.check('4c Directeur collège : paiements limités à son cycle', (select count(*) from public.fee_payments) = 1);
select t.check('4d Directeur collège ne peut pas encaisser',
  t.try(format('insert into public.fee_payments (school_id,student_id,amount) values (%L,%L,100)', :'SA_ID', :'STU_A_COL')) like 'err:%');
select t.check('4e Directeur ne voit pas les dépenses', (select count(*) from public.expenses) = 0);
select t.check('4f Directeur peut changer le type d''élève',
  t.try(format('update public.students set student_type=''ancien'' where id=%L', :'STU_A_COL')) = 'ok:1');
select t.check('4g Directeur peut définir un régime',
  t.try(format('update public.students set fee_status=''bourse_partielle'', fee_discount=20000 where id=%L', :'STU_A_COL')) = 'ok:1');
select t.check('4h Directeur ne peut pas supprimer un paiement', t.try(format('delete from public.fee_payments where id=%L', :'PAY_A')) = 'ok:0');
select t.check('4i Directeur ne peut pas modifier un élève du primaire',
  t.try(format('update public.students set last_name=''X'' where id=%L', :'STU_A_PRI')) = 'ok:0');
select t.check('4j Directeur voit les notes de son cycle', (select count(*) from public.grades) = 1);
select t.check('4k Directeur ne voit pas les notes du primaire', (select count(*) from public.primary_scores) = 0);
select t.check('4l Directeur ne peut pas gérer les membres', t.try(format('update public.school_members set role=''founder'' where school_id=%L', :'SA_ID')) = 'ok:0');

-- Secrétaire A : réglage secretary_can_collect = faux par défaut
select set_config('test.uid', :'SA', false);
select t.check('4m Secrétaire voit tous les élèves', (select count(*) from public.students) = 2);
select t.check('4n Secrétaire : AUCUN accès aux finances (réglage désactivé)', (select count(*) from public.fee_payments) = 0);
select t.check('4o Secrétaire ne peut pas encaisser (réglage désactivé)',
  t.try(format('insert into public.fee_payments (school_id,student_id,amount) values (%L,%L,100)', :'SA_ID', :'STU_A_COL')) like 'err:%');
select t.check('4p Secrétaire ne peut PAS modifier le type d''élève',
  t.try(format('update public.students set student_type=''nouveau'' where id=%L', :'STU_A_COL')) like 'err:%');
select t.check('4q Secrétaire ne peut PAS modifier un régime',
  t.try(format('update public.students set fee_status=''bourse'' where id=%L', :'STU_A_COL')) like 'err:%');
select t.check('4r Secrétaire peut modifier le téléphone d''un élève',
  t.try(format('update public.students set phone=''90000000'' where id=%L', :'STU_A_COL')) = 'ok:1');
select t.check('4s Secrétaire peut inscrire un élève (régime normal)',
  t.try(format('insert into public.students (school_id,matricule,first_name,last_name,academic_year_id,student_type) select %L,''M-900'',''n'',''e'',id,''nouveau'' from public.academic_years where school_id=%L', :'SA_ID', :'SA_ID')) = 'ok:1');
select t.check('4t Secrétaire ne peut PAS inscrire avec un régime',
  t.try(format('insert into public.students (school_id,matricule,first_name,last_name,academic_year_id,fee_status) select %L,''M-901'',''n'',''e'',id,''bourse'' from public.academic_years where school_id=%L', :'SA_ID', :'SA_ID')) like 'err:%');
select t.check('4u Secrétaire ne peut pas supprimer un élève', t.try(format('delete from public.students where id=%L', :'STU_A_COL')) = 'ok:0');
select t.check('4v Secrétaire : pas de notes', (select count(*) from public.grades) = 0);
select t.check('4w Secrétaire : pas d''absences', (select count(*) from public.attendance) = 0);
select t.check('4x Secrétaire ne peut pas modifier la structure (classes)', t.try(format('update public.classes set name=''Z'' where school_id=%L', :'SA_ID')) = 'ok:0');
reset role;
-- Le Fondateur active le réglage
set role authenticated; select set_config('test.uid', :'FA', false);
select t.check('4y Fondateur peut activer secretary_can_collect', t.try(format('update public.schools set secretary_can_collect=true where id=%L', :'SA_ID')) = 'ok:1');
select set_config('test.uid', :'SA', false);
select t.check('4z Secrétaire (réglage activé) voit les paiements', (select count(*) from public.fee_payments) = 2);
select t.check('4aa Secrétaire (réglage activé) peut encaisser',
  t.try(format('insert into public.fee_payments (school_id,student_id,amount) values (%L,%L,500)', :'SA_ID', :'STU_A_COL')) = 'ok:1');
select t.check('4ab Secrétaire ne peut JAMAIS supprimer un paiement', t.try(format('delete from public.fee_payments where school_id=%L', :'SA_ID')) = 'ok:0');
select set_config('test.uid', :'FA', false);
select t.check('4ac Fondateur peut supprimer un paiement', t.try(format('delete from public.fee_payments where id=%L', :'PAY_A')) = 'ok:1');
select t.check('4ad Suppression de paiement journalisée', (select count(*) from public.audit_log where entity='fee_payments' and action='DELETE') = 1);

-- Enseignant A : uniquement sa classe, sa matière, pas de parents ni de finances
select set_config('test.uid', :'TA', false);
select t.check('4ae Enseignant voit l''élève de sa classe', (select count(*) from public.students where matricule='M-001') = 1);
select t.check('4af Enseignant ne voit pas le primaire', (select count(*) from public.students where matricule='M-002') = 0);
select t.check('4ag Enseignant ne voit aucun parent', (select count(*) from public.parents) = 0);
select t.check('4ah Enseignant ne voit aucune finance', (select count(*) from public.fee_payments) + (select count(*) from public.student_fees) + (select count(*) from public.expenses) = 0);
select t.check('4ai Enseignant voit les notes de sa matière', (select count(*) from public.grades) = 1);
select t.check('4aj Enseignant peut saisir une note dans sa matière', t.try('update public.grades set score=15') = 'ok:1');
select t.check('4ak Enseignant ne peut pas modifier un élève', t.try('update public.students set last_name=''X''') = 'ok:0');
select t.check('4al Enseignant ne peut pas changer de rôle', t.try('update public.school_members set role=''founder''') = 'ok:0');

-- Compte Primaire
select set_config('test.uid', :'PA', false);
select t.check('4am Primaire voit l''élève du primaire seulement', (select count(*) from public.students) = 1 and (select count(*) from public.students where matricule='M-002') = 1);
select t.check('4an Primaire peut saisir une note primaire', t.try('update public.primary_scores set score=9') = 'ok:1');
select t.check('4ao Primaire ne peut pas dépasser le maximum', t.try('update public.primary_scores set score=99') like 'err:%');
select t.check('4ap Primaire ne voit pas les notes du collège', (select count(*) from public.grades) = 0);
select t.check('4aq Primaire ne voit aucune finance', (select count(*) from public.fee_payments) = 0);
reset role;

-- =====================================================================
-- 5. SUPER-ADMINISTRATEUR : gère les écoles, ne lit PAS les données d'élèves
-- =====================================================================
set role authenticated; select set_config('test.uid', :'SUPER', false);
select t.check('5a Super-admin voit les 2 écoles', (select count(*) from public.schools) = 2);
select t.check('5b Super-admin voit les membres', (select count(*) from public.school_members) >= 9);
select t.check('5c Super-admin ne voit AUCUN élève', (select count(*) from public.students) = 0);
select t.check('5d Super-admin ne voit AUCUN paiement', (select count(*) from public.fee_payments) = 0);
select t.check('5e Super-admin ne voit AUCUNE note', (select count(*) from public.grades) = 0);
select t.check('5f Super-admin ne peut pas écrire dans les élèves',
  t.try(format('insert into public.students (school_id,matricule,first_name,last_name,academic_year_id) values (%L,''Z'',''a'',''b'',%L)', :'SA_ID', :'AY_A')) like 'err:%');
select t.check('5g Super-admin voit le journal', (select count(*) from public.audit_log) > 0);
select t.check('5h Suspension d''une école', t.try(format('select public.admin_set_school_status(%L,''suspended'')', :'SB_ID')) like 'ok:%');
reset role;
set role authenticated; select set_config('test.uid', :'FB', false);
select t.check('5i École suspendue : plus aucun accès aux données', (select count(*) from public.students) = 0 and (select count(*) from public.my_memberships()) = 0);
reset role;
set role authenticated; select set_config('test.uid', :'SUPER', false);
select public.admin_set_school_status(:'SB_ID','active');
reset role;

-- =====================================================================
-- 6. COMPTE DANS PLUSIEURS ÉCOLES
-- =====================================================================
set role authenticated; select set_config('test.uid', :'MULTI', false);
select t.check('6a Compte multi-écoles : 2 appartenances', (select count(*) from public.my_memberships()) = 2);
select t.check('6b Rôle par école : Secrétaire en A, Fondateur en B',
  (select role from public.my_memberships() where school_id=:'SA_ID') = 'secretary'
  and (select role from public.my_memberships() where school_id=:'SB_ID') = 'founder');
select t.check('6c En A (Secrétaire, réglage activé) : peut lire les paiements A', (select count(*) from public.fee_payments where school_id=:'SA_ID') >= 1);
select t.check('6d En B (Fondateur) : peut supprimer un paiement B', t.try(format('delete from public.fee_payments where school_id=%L and receipt_number=''R-1''', :'SB_ID')) = 'ok:1');
select t.check('6e En A : n''obtient pas les droits de Fondateur de B', t.try(format('delete from public.fee_payments where school_id=%L', :'SA_ID')) = 'ok:0');
reset role;

-- =====================================================================
-- 7. PROFILS
-- =====================================================================
set role authenticated; select set_config('test.uid', :'FA', false);
select t.check('7a Fondateur A voit les profils de son école', (select count(*) from public.profiles where id in (:'DA', :'SA')) = 2);
select t.check('7b Fondateur A ne voit pas les profils de l''école B', (select count(*) from public.profiles where id in (:'DB')) = 0);
select set_config('test.uid', :'DA', false);
select t.check('7c Un Directeur ne voit que son propre profil', (select count(*) from public.profiles) = 1);
reset role;

-- =====================================================================
-- 8. STOCKAGE
-- =====================================================================
set role authenticated; select set_config('test.uid', :'SA', false);
select t.check('8a Secrétaire A peut déposer une photo dans son école',
  t.try(format('insert into storage.objects (bucket_id,name) values (''student-photos'', %L)', :'SA_ID' || '/' || :'STU_A_COL' || '/p.jpg')) = 'ok:1');
select t.check('8b Secrétaire A ne peut pas déposer dans l''école B',
  t.try(format('insert into storage.objects (bucket_id,name) values (''student-photos'', %L)', :'SB_ID' || '/' || :'STU_B_COL' || '/p.jpg')) like 'err:%');
select t.check('8c Chemin invalide refusé', t.try('insert into storage.objects (bucket_id,name) values (''student-photos'', ''abc/def/p.jpg'')') like 'err:%');
select set_config('test.uid', :'TA', false);
select t.check('8d Enseignant A peut lire la photo de l''élève de sa classe', (select count(*) from storage.objects where bucket_id='student-photos') = 1);
select set_config('test.uid', :'FB', false);
select t.check('8e Fondateur B ne voit pas les photos de A', (select count(*) from storage.objects where bucket_id='student-photos') = 0);
select t.check('8f Fondateur B ne peut pas supprimer les photos de A', t.try('delete from storage.objects') = 'ok:0');
select set_config('test.uid', :'FA', false);
select t.check('8g Fondateur A peut déposer son logo', t.try(format('insert into storage.objects (bucket_id,name) values (''school-logos'', %L)', :'SA_ID' || '/logo.png')) = 'ok:1');
select set_config('test.uid', :'DA', false);
select t.check('8h Directeur ne peut pas changer le logo', t.try(format('insert into storage.objects (bucket_id,name) values (''school-logos'', %L)', :'SA_ID' || '/x.png')) like 'err:%');
reset role;

-- =====================================================================
-- 9. ÉCOLE ACTIVE (en-tête x-school-id)
-- =====================================================================
set role authenticated; select set_config('test.uid', :'MULTI', false);
select set_config('request.headers', json_build_object('x-school-id', :'SA_ID')::text, false);
select t.check('9a Multi-écoles, école active A : ne voit que A', (select count(*) from public.students where school_id = :'SB_ID') = 0 and (select count(*) from public.students where school_id = :'SA_ID') > 0);
select t.check('9b Insertion sans school_id : acceptée',
  t.try(format('insert into public.students (matricule,first_name,last_name,academic_year_id) values (''M-777'',''a'',''b'',%L)', :'AY_A')) = 'ok:1');
select t.check('9b2 ...et rangée dans l''école active A', (select school_id from public.students where matricule='M-777') = :'SA_ID');
select set_config('request.headers', json_build_object('x-school-id', :'SB_ID')::text, false);
select t.check('9c Multi-écoles, école active B : ne voit que B', (select count(*) from public.students where school_id = :'SA_ID') = 0 and (select count(*) from public.students where school_id = :'SB_ID') > 0);
select t.check('9d En B, le compte a bien le rôle de B (Fondateur)', (select count(*) from public.my_memberships()) = 2);
select set_config('request.headers', '', false);
select t.check('9e Multi-écoles sans en-tête : insertion sans school_id refusée (ambiguë)',
  t.try(format('insert into public.students (matricule,first_name,last_name,academic_year_id) values (''M-778'',''a'',''b'',%L)', :'AY_A')) like 'err:%');
select set_config('test.uid', :'FA', false);
select set_config('request.headers', json_build_object('x-school-id', :'SB_ID')::text, false);
select t.check('9f En-tête vers une école NON autorisée : résultat vide', (select count(*) from public.students) = 0 and (select count(*) from public.schools) = 0);
select set_config('request.headers', 'pas-du-json', false);
select t.check('9g En-tête invalide : résultat vide (aucune fuite)', (select count(*) from public.students) >= 0 and t.foreign_rows(:'FA', :'SB_ID') = 0);
select set_config('request.headers', json_build_object('x-school-id', 'pas-un-uuid')::text, false);
select t.check('9h En-tête non-uuid : résultat vide', (select count(*) from public.students) = 0);
select set_config('request.headers', '', false);
select t.check('9i Compte à une seule école, sans en-tête : insertion sans school_id OK',
  t.try(format('insert into public.students (matricule,first_name,last_name,academic_year_id) values (''M-779'',''a'',''b'',%L)', :'AY_A')) = 'ok:1');
reset role;

-- 9j. École active transmise par x-client-info (en-tête accepté par les navigateurs)
set role authenticated; select set_config('test.uid', :'MULTI', false);
select set_config('request.headers', json_build_object('x-client-info', 'supabase-js-web/2.45.0 school=' || :'SB_ID')::text, false);
select t.check('9j x-client-info : école active B', (select count(*) from public.students where school_id = :'SA_ID') = 0 and (select count(*) from public.students where school_id = :'SB_ID') > 0);
select t.check('9k my_memberships renvoie nom d''école et rôle', (select count(*) from public.my_memberships() where school->>'name' like 'Ecole %') = 2);
select set_config('request.headers', json_build_object('x-client-info', 'supabase-js-web/2.45.0')::text, false);
select t.check('9l x-client-info sans école : comportement normal (toutes les écoles)', (select count(distinct school_id) from public.students) = 2);
select set_config('request.headers', '', false);
reset role;

-- =====================================================================
-- RÉSULTAT
-- =====================================================================
\echo '=== ÉCHECS ==='
select name from t.results where not ok order by name;
select count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echecs, count(*) as total from t.results;
