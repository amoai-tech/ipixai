-- Consolidate organizer_team_members SELECT policies
DROP POLICY IF EXISTS "team_members_select_organizer_team_members" ON public.organizer_team_members;
DROP POLICY IF EXISTS "team_owners_select_organizer_team_members" ON public.organizer_team_members;

CREATE POLICY "organizer_team_members_select" ON public.organizer_team_members
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid()) OR
    EXISTS (
      SELECT 1
      FROM organizer_team_members otm
      WHERE (otm.team_id = organizer_team_members.team_id) 
        AND (otm.user_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1
      FROM organizer_teams
      WHERE (organizer_teams.id = organizer_team_members.team_id) 
        AND (organizer_teams.owner_id = auth.uid())
    )
  );
