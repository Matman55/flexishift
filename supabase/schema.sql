-- FlexiShift — plak dit in Supabase → SQL Editor → Run
-- Daarna: Authentication → URL Configuration → Redirect URLs
--   http://localhost:5173/**
--   https://matman55.github.io/flexishift/**

create extension if not exists pg_net;
create extension if not exists http with schema extensions;

create table if not exists public.app_config (
  key text primary key,
  value text not null
);

create table if not exists public.seekers (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.employers (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key,
  employer_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id text primary key,
  seeker_id text not null,
  employer_id text not null,
  job_id text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  request_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
alter table public.seekers enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;

drop policy if exists "read seekers" on public.seekers;
create policy "read seekers" on public.seekers for select using (true);
drop policy if exists "write own seeker" on public.seekers;
create policy "write own seeker" on public.seekers for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read employers" on public.employers;
create policy "read employers" on public.employers for select using (true);
drop policy if exists "write own employer" on public.employers;
create policy "write own employer" on public.employers for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read jobs" on public.jobs;
create policy "read jobs" on public.jobs for select using (true);
drop policy if exists "insert jobs" on public.jobs;
create policy "insert jobs" on public.jobs for insert with check (
  exists (select 1 from public.employers e where e.id = employer_id and e.user_id = auth.uid())
);
drop policy if exists "update jobs" on public.jobs;
create policy "update jobs" on public.jobs for update using (
  exists (select 1 from public.employers e where e.id = employer_id and e.user_id = auth.uid())
  or exists (
    select 1 from public.requests r
    join public.seekers s on s.id = r.seeker_id
    where s.user_id = auth.uid() and (r.job_id = jobs.id or r.data->>'jobId' = jobs.id)
  )
);

drop policy if exists "read requests" on public.requests;
create policy "read requests" on public.requests for select using (true);
drop policy if exists "insert requests" on public.requests;
create policy "insert requests" on public.requests for insert with check (auth.uid() is not null);
drop policy if exists "update requests" on public.requests;
create policy "update requests" on public.requests for update using (
  exists (select 1 from public.seekers s where s.id = seeker_id and s.user_id = auth.uid())
  or exists (select 1 from public.employers e where e.id = employer_id and e.user_id = auth.uid())
);

drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages for select using (true);
drop policy if exists "write messages" on public.messages;
create policy "write messages" on public.messages for all using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := coalesce(new.raw_user_meta_data->>'role', 'seeker');
  eid text;
begin
  if r = 'employer' then
    eid := 'e-' || replace(new.id::text, '-', '');
    insert into public.employers (id, user_id, data)
    values (
      eid,
      new.id,
      jsonb_build_object(
        'id', eid,
        'userId', new.id::text,
        'company', '',
        'contact', '',
        'city', 'Gent',
        'sector', 'Horeca',
        'hue', 18,
        'onboardingDone', false,
        'favorites', '[]'::jsonb,
        'savedSearches', '[]'::jsonb,
        'email', new.email,
        'mailPrefs', jsonb_build_object(
          'enabled', true, 'ask', true, 'apply', true, 'accepted', true,
          'declined', true, 'cancelled', true, 'message', true, 'job', true, 'welcome', true
        ),
        'workplace', jsonb_build_object(
          'address', 'Centrum Gent', 'postal', '9000', 'city', 'Gent',
          'lat', 51.0543, 'lng', 3.7174
        )
      )
    )
    on conflict (id) do nothing;
  else
    eid := 's-' || replace(new.id::text, '-', '');
    insert into public.seekers (id, user_id, data)
    values (
      eid,
      new.id,
      jsonb_build_object(
        'id', eid,
        'userId', new.id::text,
        'name', '',
        'city', 'Gent',
        'hue', 18,
        'bio', '',
        'sectors', '[]'::jsonb,
        'skills', '[]'::jsonb,
        'languages', jsonb_build_array('Nederlands'),
        'hasLicense', false,
        'hasTransport', false,
        'yearsExperience', 1,
        'hourlyRateMin', 14,
        'lastMinute', true,
        'jobsDone', 0,
        'recurring', jsonb_build_object(
          'mon', '[]'::jsonb, 'tue', '[]'::jsonb, 'wed', '[]'::jsonb, 'thu', '[]'::jsonb,
          'fri', '[]'::jsonb, 'sat', '[]'::jsonb, 'sun', '[]'::jsonb
        ),
        'hours', '{}'::jsonb,
        'overrides', '{}'::jsonb,
        'blocked', '[]'::jsonb,
        'onboardingDone', false,
        'email', new.email,
        'mailPrefs', jsonb_build_object(
          'enabled', true, 'ask', true, 'apply', true, 'accepted', true,
          'declined', true, 'cancelled', true, 'message', true, 'job', true, 'welcome', true
        )
      )
    )
    on conflict (id) do nothing;
  end if;

  begin
    perform public.deliver_flexi_mail(
      new.email,
      coalesce(new.email, 'daar'),
      'Welkom bij FlexiShift',
      'Je account is aangemaakt. Vul je profiel in — dan kun je jobs plaatsen of aannemen.'
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.deliver_flexi_mail(
  p_to text,
  p_to_name text,
  p_subject text,
  p_preview text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  api_key text;
  from_addr text;
  site_url text;
  allowed boolean;
  body jsonb;
  body_text text;
  safe_preview text;
  resp_status int;
  resp_content text;
  err_msg text;
begin
  if p_to is null or length(trim(p_to)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'missing_address');
  end if;

  select exists (
    select 1 from public.seekers s
    where lower(coalesce(s.data->>'email', '')) = lower(trim(p_to))
    union all
    select 1 from public.employers e
    where lower(coalesce(e.data->>'email', '')) = lower(trim(p_to))
    union all
    select 1 from auth.users u
    where lower(coalesce(u.email, '')) = lower(trim(p_to))
  ) into allowed;

  if not allowed then
    return jsonb_build_object('ok', false, 'reason', 'unknown_recipient');
  end if;

  if p_to ilike '%@flexishift.be' then
    return jsonb_build_object('ok', false, 'reason', 'demo_address');
  end if;

  select value into api_key from public.app_config where key = 'resend_api_key';
  select value into from_addr from public.app_config where key = 'resend_from';
  select value into site_url from public.app_config where key = 'site_url';

  if api_key is null or length(trim(api_key)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'mail_not_configured');
  end if;

  -- Zonder geverifieerd domein mag alleen Resend's testdfzender.
  if from_addr is null
     or from_addr !~ '@'
     or from_addr ilike '%example.com%'
     or from_addr ilike '%localhost%'
     or from_addr ilike '%gmail.com%'
     or from_addr ilike '%outlook.%'
     or from_addr ilike '%hotmail.%' then
    from_addr := 'FlexiShift <beth.t@example.com>';
  end if;

  safe_preview := replace(replace(replace(coalesce(p_preview, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  body := jsonb_build_object(
    'from', coalesce(nullif(trim(from_addr), ''), 'FlexiShift <beth.t@example.com>'),
    'to', jsonb_build_array(trim(p_to)),
    'subject', p_subject,
    'html', concat(
      '<div style="font-family:Georgia,serif;max-width:520px;line-height:1.5;color:#111">',
      '<p>Hallo ', replace(coalesce(p_to_name, ''), '<', ''), ',</p>',
      '<p>', replace(safe_preview, chr(10), '<br>'), '</p>',
      '<p><a href="', coalesce(site_url, 'https://matman55.github.io/flexishift/'),
      '" style="background:#c45c26;color:#111;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Open FlexiShift</a></p>',
      '</div>'
    )
  );
  body_text := body::text;

  begin
    select status, content
      into resp_status, resp_content
    from extensions.http((
      'POST',
      'https://api.resend.com/emails',
      array[
        extensions.http_header('Authorization', 'Bearer ' || trim(api_key)),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      body_text
    )::extensions.http_request);
  exception when others then
    begin
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || trim(api_key),
          'Content-Type', 'application/json'
        ),
        body := body,
        timeout_milliseconds := 8000
      );
      return jsonb_build_object('ok', true, 'queued', true);
    exception when others then
      get stacked diagnostics err_msg = message_text;
      return jsonb_build_object('ok', false, 'reason', 'http_failed', 'detail', err_msg);
    end;
  end;

  if resp_status is null then
    return jsonb_build_object('ok', false, 'reason', 'http_failed', 'detail', 'geen antwoord van Resend');
  end if;

  if resp_status >= 200 and resp_status < 300 then
    return jsonb_build_object('ok', true);
  end if;

  begin
    err_msg := coalesce((resp_content::jsonb)->>'message', resp_content);
  exception when others then
    err_msg := resp_content;
  end;

  return jsonb_build_object(
    'ok', false,
    'reason', 'resend',
    'status', resp_status,
    'detail', err_msg
  );
end;
$$;

create or replace function public.flexi_mail_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  from_addr text;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  select value into api_key from public.app_config where key = 'resend_api_key';
  select value into from_addr from public.app_config where key = 'resend_from';
  return jsonb_build_object(
    'configured', api_key is not null and length(trim(api_key)) > 8,
    'from', coalesce(from_addr, ''),
    'has_http', exists (select 1 from pg_extension where extname = 'http'),
    'has_pg_net', exists (select 1 from pg_extension where extname = 'pg_net')
  );
end;
$$;

create or replace function public.flexi_send_test_mail()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  select email into addr from auth.users where id = auth.uid();
  if addr is null or length(trim(addr)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'missing_address');
  end if;
  return public.deliver_flexi_mail(
    addr,
    split_part(addr, '@', 1),
    'Testmail FlexiShift',
    'Als je deze mail ziet, werken de meldingen. Check ook je spambox.'
  );
end;
$$;

grant execute on function public.deliver_flexi_mail(text, text, text, text) to authenticated;
grant execute on function public.flexi_mail_status() to authenticated;
grant execute on function public.flexi_send_test_mail() to authenticated;

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

alter table public.seekers replica identity full;
alter table public.employers replica identity full;
alter table public.jobs replica identity full;
alter table public.requests replica identity full;
alter table public.messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.seekers;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.employers;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.jobs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

