-- Migration 022: Admin group management
-- Allow group creator to delete the group (cascades to group_members via FK)
CREATE POLICY "groups_delete_creator"
  ON groups FOR DELETE
  USING (created_by = auth.uid());

-- Allow group creator to remove other members from their group
-- (cannot remove themselves — use leaveGroup for that)
CREATE POLICY "group_members_delete_admin"
  ON group_members FOR DELETE
  USING (
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid())
    AND user_id != auth.uid()
  );
