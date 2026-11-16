-- The legacy request-creation RPC is internal-only.
-- Client requests must go through create_client_request_with_consent.
revoke all on function public.create_client_request(uuid,text,text,text) from public,anon,authenticated;
