# EaseDrive Go

Partner-based car rental marketplace. Next.js 15 + TypeScript + Supabase (Auth, Postgres RLS, Storage).

## Setup (VS Code)
1. `npm install`
2. Supabase project: SQL editor, run in order: `supabase/schema.sql`, `supabase/002_backend.sql`, `supabase/003_app.sql`, `supabase/004_optional_permit.sql`, `supabase/005_admin_partner_access.sql`, `supabase/006_profile_backfill.sql`, `supabase/007_admin_ids.sql`, `supabase/008_live_booking_locations.sql`.
3. Migration `007_admin_ids.sql` creates and configures the Storage buckets: `hero` and `vehicles` (public), `documents` and `ids` (private). If you created the buckets earlier, re-run `007_admin_ids.sql` so their visibility is corrected.
4. Copy `.env.example` to `.env.local` and fill the project URL and anon key (Project Settings > API). Never use the service-role key in this app.
5. Auth > URL config: Site URL `http://localhost:3000` (and your production URL later). For quick tests you may turn off "Confirm email".
6. `npm run dev`, open http://localhost:3000, sign up, then make yourself admin in the SQL editor:
   `update profiles set role='admin' where id=(select id from auth.users where email='YOU@EMAIL');`
   An admin account can also manage its approved partner record; the profile role remains `admin`.
7. Enable `pg_cron` and schedule: `select cron.schedule('expire','*/10 * * * *','select expire_pending()');` and `select cron.schedule('prune-live-locations','* * * * *','select prune_booking_live_locations()');`
8. Deploy: push to GitHub, import in Vercel, set the 2 env vars, add the Vercel URL to Supabase Auth URL config.

## Flow to test
Customer signs up > Become a Partner (optional permit) > Admin: Record signed contract, set Approved > Partner: add vehicle (and rates), publish (admin review if enabled) > Customer: pick dates, price computed by server, submit > Partner approves > Customer sees Confirmed.
`supabase/tests/scenarios.sql` runs DB-level checks on a scratch database.
Confirmed bookings can use opt-in live location sharing after admin enablement. Customer and assigned partner must each start sharing; only those two can view coordinates. Admin can enable or disable sharing but cannot read coordinates. The map uses OpenStreetMap tiles, and GPS updates stop when the sharing page is hidden or closed.

## Not included yet
Payments, email/SMS, in-app messaging UI (API + DB exist: /api/messages), notifications page, profile page, reviews UI, hero image admin UI (upload to bucket `hero` and insert into `hero_images`), vehicle edit screen (API exists: PATCH /api/vehicles/[id]).

## Update v3
- Partner and Admin are no longer in the menu. After login each role goes to its own dashboard automatically; the footer link "Partner portal" (`/portal`) also sends you to the right place. `/partner` and `/admin` stay protected on the server.
- Android/iPhone: full-screen app with bottom navigation. Desktop: wide layout with top navigation.
- Auth: friendly errors, email confirmation and password reset links. In Supabase > Auth > URL Configuration add Redirect URLs: `http://localhost:3000/auth/callback` (and your Vercel URL + `/auth/callback`).
- Prices are not shown on the Home list; they are computed on the vehicle page after you choose dates.
- Line endings are LF (`.gitattributes`, `.editorconfig`). `.vscode/settings.json` turns off format on save.
- `npm run typecheck` verifies the code compiles.

## Update v4: full admin control + customer valid ID
- Admin dashboard: customers (add, suspend, reactivate, set temporary password, delete), partners (add, edit, suspend, reactivate = restore access, set temporary password, delete), applications, vehicles (add for any partner, approve, publish, archive, delete), bookings (approve, reject, cancel, complete, delete), front page images (upload, reorder, remove), settings, activity log.
- Customers must upload a valid ID (private bucket `ids`) before they can submit a booking. Partners can view/verify/reject the ID of their own customers; admin can for everyone. A booking cannot be approved if the customer has no ID on file or it was rejected.
- "Add customer/partner" and "Set password" need `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server only, never NEXT_PUBLIC; restart `npm run dev`). Everything else works without it.
- Deleting is blocked when it would break records (customers/partners/vehicles with bookings): suspend or archive instead.
