-- Remove the obsolete eight-argument consent RPC overload.
-- All client requests must use the slot-aware function protected by the intake gate.
revoke all on function public.create_client_request_with_consent(uuid,text,text,text,text,boolean,text,text) from public,anon,authenticated;
