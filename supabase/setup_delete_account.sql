-- FlexiShift — account verwijderen
-- Plak dit in Supabase → SQL Editor → Run
-- (eenmalig, ook als schema.sql al eerder is uitgevoerd)

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid text;
  eid text;
begin
  if uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select id into sid from public.seekers where user_id = uid;
  select id into eid from public.employers where user_id = uid;

  delete from public.messages
  where request_id in (
    select r.id from public.requests r
    where (sid is not null and r.seeker_id = sid)
       or (eid is not null and r.employer_id = eid)
  );

  delete from public.requests
  where (sid is not null and seeker_id = sid)
     or (eid is not null and employer_id = eid);

  if eid is not null then
    delete from public.jobs where employer_id = eid;
  end if;

  delete from public.seekers where user_id = uid;
  delete from public.employers where user_id = uid;
  delete from auth.users where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
