-- RADYAD follow-up hardening for the existing test project.
-- Safe, non-destructive operations only.
-- Move the relocatable btree_gist extension out of the exposed public schema.
ALTER EXTENSION btree_gist SET SCHEMA extensions;

-- Cover the workshops.created_by foreign key used by admin/audit queries.
CREATE INDEX IF NOT EXISTS workshops_created_by_idx
  ON public.workshops (created_by)
  WHERE created_by IS NOT NULL;
