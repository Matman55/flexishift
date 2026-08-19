-- FlexiShift mails — plak dit VOLLEDIG in Supabase → SQL Editor → Run
-- (mag opnieuw; vervangt de oude mail-functie)
--
-- Daarna nog een tweede query: API-key van https://resend.com → API Keys
-- (het INSERT-blok helemaal onderaan, uncomment + vervang re_xxxx)

create extension if not exists pg_net;
create extension if not exists http with schema extensions;

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
  select value into site_url from public.app_config where key = 'site_url';

  if api_key is null or length(trim(api_key)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'mail_not_configured');
  end if;

  -- Testdfzender; eigen domein later via resend_from als dat geen example.com is.
  from_addr := 'FlexiShift <beth.t@example.com>';

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

-- Welkomstmail mag account-aanmaak nooit blokkeren
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
      eid, new.id,
      jsonb_build_object(
        'id', eid, 'userId', new.id::text, 'company', '', 'contact', '',
        'city', 'Gent', 'sector', 'Horeca', 'hue', 18, 'onboardingDone', false,
        'favorites', '[]'::jsonb, 'savedSearches', '[]'::jsonb, 'email', new.email,
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
    on conflict (user_id) do update set
      data = public.employers.data || jsonb_build_object('email', new.email, 'userId', new.id::text);
  else
    eid := 's-' || replace(new.id::text, '-', '');
    insert into public.seekers (id, user_id, data)
    values (
      eid, new.id,
      jsonb_build_object(
        'id', eid, 'userId', new.id::text, 'name', '', 'city', 'Gent', 'hue', 18, 'bio', '',
        'sectors', '[]'::jsonb, 'skills', '[]'::jsonb,
        'languages', jsonb_build_array('Nederlands'),
        'hasLicense', false, 'hasTransport', false, 'yearsExperience', 1,
        'hourlyRateMin', 14, 'lastMinute', true, 'jobsDone', 0,
        'recurring', jsonb_build_object(
          'mon', '[]'::jsonb, 'tue', '[]'::jsonb, 'wed', '[]'::jsonb, 'thu', '[]'::jsonb,
          'fri', '[]'::jsonb, 'sat', '[]'::jsonb, 'sun', '[]'::jsonb
        ),
        'hours', '{}'::jsonb, 'overrides', '{}'::jsonb, 'blocked', '[]'::jsonb,
        'onboardingDone', false, 'email', new.email,
        'mailPrefs', jsonb_build_object(
          'enabled', true, 'ask', true, 'apply', true, 'accepted', true,
          'declined', true, 'cancelled', true, 'message', true, 'job', true, 'welcome', true
        )
      )
    )
    on conflict (user_id) do update set
      data = public.seekers.data || jsonb_build_object('email', new.email, 'userId', new.id::text);
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

grant execute on function public.deliver_flexi_mail(text, text, text, text) to authenticated;
grant execute on function public.deliver_flexi_mail(text, text, text, text) to service_role;
grant execute on function public.flexi_mail_status() to authenticated;
grant execute on function public.flexi_send_test_mail() to authenticated;

-- === Stap 2: uncomment, vervang re_xxxx, Run ===
-- insert into public.app_config (key, value) values
--   ('resend_api_key', 're_xxxx'),
--   ('resend_from', 'FlexiShift <beth.t@example.com>'),
--   ('site_url', 'https://matman55.github.io/flexishift/')
-- on conflict (key) do update set value = excluded.value;
