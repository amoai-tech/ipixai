-- Consolidate task_assignees SELECT policies
DROP POLICY IF EXISTS "users can view own task assignments" ON public.task_assignees;
DROP POLICY IF EXISTS "organizers can view task assignments" ON public.task_assignees;

-- Create consolidated SELECT policy
CREATE POLICY "task_assignees_select" ON public.task_assignees
  FOR SELECT
  TO authenticated
  USING (
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN event_phases ON event_phases.id = tasks.phase_id
      JOIN events ON events.id = event_phases.event_id
      WHERE tasks.id = task_assignees.task_id
        AND events.organizer_id = auth.uid()
    )
  );
