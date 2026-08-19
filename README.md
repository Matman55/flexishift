# FlexiShift

Matching-app voor Belgische flexijobs: shiftwerkers zetten hun vrije uren klaar, werkgevers vinden wie écht kan.

Dit is een **React + Vite**-website. Online via **GitHub Pages**.

## Demo

Zonder account kun je nog altijd de demo openen: Emma Peeters (werknemer) of Café De Kroon (zaak).

## Echte accounts + echte e-mail

Daarvoor zijn twee gratis diensten nodig: **Supabase** (accounts + data) en **Resend** (mails).

### 1. Supabase

1. Maak een project op [supabase.com](https://supabase.com).
2. **SQL Editor** → plak `supabase/schema.sql` → Run.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173` (lokaal) en later `https://matman55.github.io/flexishift/`
   - Redirect URLs: `http://localhost:5173/**` en `https://matman55.github.io/flexishift/**`
4. **Authentication → Providers → Email**
   - Voor een snelle test: *Confirm email* uitzetten. Daarna weer aanzetten: gebruikers krijgen dan een echte bevestigingsmail.
5. **Project Settings → API**: kopieer Project URL en `anon` `public` key.

### 2. App-config (.env)

Kopieer `.env.example` naar `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Herstart `npm run dev`.

### 3. E-mail (Resend) — nodig voor echte mails

Zonder deze stap worden accounts wel aangemaakt, maar **er vertrekt geen mail** bij welkom, aanvaarde job, sollicitatie of chat.

1. Maak een gratis account op [resend.com](https://resend.com) **met hetzelfde e-mailadres** dat je in FlexiShift gebruikt (anders komen testmails niet aan).
2. **API Keys → Create API Key** → kopieer de key (`re_...`).
3. In Supabase: **SQL Editor** → plak `supabase/setup_mail.sql` → **Run**.
4. Nieuwe query, plak dit (vervang `re_xxxx`):

```sql
insert into public.app_config (key, value) values
  ('resend_api_key', 're_xxxx'),
  ('resend_from', 'FlexiShift <beth.t@example.com>'),
  ('site_url', 'https://matman55.github.io/flexishift/')
on conflict (key) do update set value = excluded.value;
```

5. **Run**.

6. In FlexiShift (ingelogd met je echte account): **Profiel** of **Home** → *Stuur testmail*. De app toont waarom het misgaat als er geen mail vertrekt.

Zolang je geen eigen domein hebt bij Resend, komen mails **alleen aan** op het e-mailadres van je Resend-account. Check ook spam.

**Account-bevestiging** (aparte mail van Supabase, niet via Resend): Authentication → Providers → Email → **Confirm email**. Die mail komt van Supabase zelf; zonder eigen SMTP belandt die vaak in spam of komt ze traag.

Controleren of de key écht staat (toont niet de volledige key):

```sql
select key,
  case when key = 'resend_api_key'
    then (length(value) > 8)::text
    else value
  end as value
from public.app_config
where key in ('resend_api_key', 'resend_from', 'site_url');
```

### 4. Account verwijderen

Bestaande projecten: **SQL Editor** → plak `supabase/setup_delete_account.sql` → **Run**.

Daarna staat bij **Profiel** (werknemer) of onderaan **Home** (zaak) de knop *Account verwijderen*. Dat wist het inlogaccount plus profiel, jobs, aanvragen en berichten. De demo (Emma / De Kroon) kun je niet wissen.

### 5. GitHub Pages

In de GitHub-repo: **Settings → Secrets and variables → Actions**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Daarna een push naar `main`. De workflow bouwt de site met die keys.

## Lokaal

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).
