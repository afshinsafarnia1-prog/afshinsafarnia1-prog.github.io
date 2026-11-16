-- Defense in depth: these private tables are accessed only through narrowly
-- scoped SECURITY DEFINER RPCs with role/ownership checks. Browser roles must
-- not have direct table privileges, even though RLS is enabled.
revoke all privileges on table
  public.payout_accounts,
  public.site_settings,
  public.workshop_proposals,
  public.workshop_registrations,
  public.yad_public_contacts,
  public.yad_tariff_history
from public, anon, authenticated;
