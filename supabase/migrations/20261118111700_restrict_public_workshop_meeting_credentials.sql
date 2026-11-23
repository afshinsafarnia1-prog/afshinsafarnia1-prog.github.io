-- Prevent public and authenticated Data API clients from reading private workshop meeting credentials.
-- Public workshop listings continue to work with an explicit allow-list of non-secret columns.
revoke select on table public.workshops from public, anon, authenticated;
grant select (
  id, slug, title, summary, description, presenter_name, presenter_bio,
  languages, topics, format, platform, venue, starts_at, ends_at, timezone,
  capacity, fee_amount, currency, status, registration_deadline
) on table public.workshops to anon, authenticated;

-- Keep private meeting credentials accessible only through privileged SECURITY DEFINER RPCs.
revoke select (meeting_url, meeting_password) on table public.workshops from public, anon, authenticated;
