-- Seed sample host listings (Discover was empty) and add automatic expiry so seeded/stale dinners
-- don't linger forever: status flips 'published' -> 'past' once the date passes, and rows are fully
-- deleted a month after that as a safety window rather than immediately.

-- 1. Four synthetic host accounts. profiles.id is FK'd to auth.users.id, so the auth row has to exist
--    first; these are seed-only accounts (random password, no real inbox) and never expected to log in.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111101', 'authenticated', 'authenticated', 'seed-host-noa@shishi.seed', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"seed","providers":["seed"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111102', 'authenticated', 'authenticated', 'seed-host-eitan@shishi.seed', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"seed","providers":["seed"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111103', 'authenticated', 'authenticated', 'seed-host-shira@shishi.seed', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"seed","providers":["seed"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111104', 'authenticated', 'authenticated', 'seed-host-daniel@shishi.seed', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"seed","providers":["seed"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into profiles (id, email, name, is_attendee, is_host, kosher_level, interests, fun_fact)
values
  ('11111111-1111-1111-1111-111111111101', 'seed-host-noa@shishi.seed', 'Noa Levi', false, true, 'kosher', '{"cooking","music"}', 'Makes her own challah every week.'),
  ('11111111-1111-1111-1111-111111111102', 'seed-host-eitan@shishi.seed', 'Eitan Cohen', false, true, 'strictly_kosher', '{"torah study","hiking"}', 'Hosted over 50 Shabbat dinners.'),
  ('11111111-1111-1111-1111-111111111103', 'seed-host-shira@shishi.seed', 'Shira Ben-David', false, true, 'not_kosher', '{"art","travel"}', 'Runs a rooftop dinner every Friday.'),
  ('11111111-1111-1111-1111-111111111104', 'seed-host-daniel@shishi.seed', 'Daniel Mizrahi', false, true, 'kosher', '{"guitar","cooking"}', 'Third-generation Tel Aviv host family.')
on conflict (id) do nothing;

insert into host_details (profile_id, bio, home_vibe, dinners_hosted_count)
values
  ('11111111-1111-1111-1111-111111111101', 'Warm, casual dinners for new olim and students.', 'Cozy & relaxed', 12),
  ('11111111-1111-1111-1111-111111111102', 'Traditional Shabbat with a full spread every week.', 'Traditional & lively', 50),
  ('11111111-1111-1111-1111-111111111103', 'Rooftop dinners with a young professional crowd.', 'Big & lively', 8),
  ('11111111-1111-1111-1111-111111111104', 'Family-style table, always room for one more.', 'Families welcome', 30)
on conflict (profile_id) do nothing;

-- 2. Eight dinners across those four hosts, dated on the next two upcoming Fridays so they expire
--    (flip to 'past') soon per product request rather than sitting live indefinitely.
do $$
declare
  next_friday date := current_date + (((5 - extract(dow from current_date)::int + 7) % 7) || ' days')::interval;
  following_friday date;
begin
  if next_friday = current_date then
    next_friday := next_friday + 7;
  end if;
  following_friday := next_friday + 7;

  insert into dinners (
    host_id, date, start_time, capacity, area, kosher_level, cost_per_head, is_free, description,
    approval_mode, dinner_type_tags
  )
  values
    ('11111111-1111-1111-1111-111111111101', next_friday, '19:30', 8, 'Florentin, Tel Aviv', 'kosher', 0, true, 'Casual Shabbat dinner, big table, new immigrants very welcome.', 'auto_accept', '{"Olim (new immigrants)","Students"}'),
    ('11111111-1111-1111-1111-111111111101', following_friday, '19:30', 6, 'Florentin, Tel Aviv', 'kosher', 0, true, 'Second seating for next week, same warm vibe.', 'auto_accept', '{"Olim (new immigrants)","Quiet & intimate"}'),
    ('11111111-1111-1111-1111-111111111102', next_friday, '19:00', 12, 'Rehavia, Jerusalem', 'strictly_kosher', 50, false, 'Full traditional Shabbat spread, singing and divrei torah.', 'host_approves', '{"Traditional","Families welcome"}'),
    ('11111111-1111-1111-1111-111111111102', following_friday, '19:00', 10, 'Rehavia, Jerusalem', 'strictly_kosher', 50, false, 'Same table, following week.', 'host_approves', '{"Traditional"}'),
    ('11111111-1111-1111-1111-111111111103', next_friday, '20:00', 14, 'Rothschild, Tel Aviv', 'not_kosher', 80, false, 'Rooftop dinner, young professional crowd, drinks included.', 'auto_accept', '{"Young professionals","Big & lively"}'),
    ('11111111-1111-1111-1111-111111111103', following_friday, '20:00', 14, 'Rothschild, Tel Aviv', 'not_kosher', 80, false, 'Next week''s rooftop dinner.', 'auto_accept', '{"Young professionals","Big & lively"}'),
    ('11111111-1111-1111-1111-111111111104', next_friday, '19:30', 10, 'Ramat Gan', 'kosher', 0, true, 'Family-style dinner, kids and guests of all ages welcome.', 'auto_accept', '{"Families welcome","Traditional"}'),
    ('11111111-1111-1111-1111-111111111104', following_friday, '19:30', 10, 'Ramat Gan', 'kosher', 0, true, 'Following week, same table.', 'auto_accept', '{"Families welcome"}');
end $$;

-- 3. Expiry: once a dinner's date has passed, flip it out of the live 'published' feed. Runs daily.
create or replace function expire_past_dinners() returns void
language sql
as $$
  update dinners
  set status = 'past'
  where status = 'published' and date < current_date;
$$;

-- 4. Cleanup: fully delete dinners a month after they went past, as a safety window rather than
--    deleting immediately (per product request — keep for ~30 days "just in case").
create or replace function delete_expired_dinners() returns void
language sql
as $$
  delete from dinners
  where status = 'past' and date < current_date - interval '30 days';
$$;

create extension if not exists pg_cron with schema extensions;

-- cron.schedule upserts by job name, so re-running this migration is safe.
select cron.schedule('expire-past-dinners-daily', '0 3 * * *', $$select expire_past_dinners()$$);
select cron.schedule('delete-expired-dinners-daily', '15 3 * * *', $$select delete_expired_dinners()$$);
