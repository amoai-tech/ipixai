-- IPI-1449: Guard the GenUI key from Mastra's stale whole-metadata rewrites.
-- Only the trusted server-side CAS transaction intentionally changes this key.
-- PostgreSQL 17 accepts arbitrary two-part custom settings (no ALTER SYSTEM).
-- This transaction-local coordination flag is NOT authorization; RLS and
-- the server-derived resourceId are the tenant security boundary.
CREATE OR REPLACE FUNCTION mastra.preserve_thread_genui_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('ipix.genui_atomic_write', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF OLD.metadata ? 'ipixGenUI' THEN
    NEW.metadata := jsonb_set(
      coalesce(NEW.metadata, '{}'::jsonb),
      '{ipixGenUI}',
      OLD.metadata -> 'ipixGenUI',
      true
    );
  ELSIF NEW.metadata ? 'ipixGenUI' THEN
    NEW.metadata := NEW.metadata - 'ipixGenUI';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mastra.preserve_thread_genui_metadata() FROM PUBLIC;
DROP TRIGGER IF EXISTS preserve_thread_genui_metadata ON mastra.mastra_threads;
CREATE TRIGGER preserve_thread_genui_metadata
BEFORE UPDATE OF metadata ON mastra.mastra_threads
FOR EACH ROW
EXECUTE FUNCTION mastra.preserve_thread_genui_metadata();
