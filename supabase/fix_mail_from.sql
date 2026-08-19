-- Plak dit HELE bestand in Supabase → SQL Editor → Run
-- Onderaan moet je beth.t@example.com zien.

insert into public.app_config (key, value) values
  ('resend_from', 'FlexiShift <beth.t@example.com>')
on conflict (key) do update set value = excluded.value;

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
  from_addr text := 'FlexiShift <beth.t@example.com>';
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

  safe_preview := replace(replace(replace(coalesce(p_preview, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  body := jsonb_build_object(
    'from', from_addr,
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

grant execute on function public.deliver_flexi_mail(text, text, text, text) to authenticated;

select value as afzender from public.app_config where key = 'resend_from';
