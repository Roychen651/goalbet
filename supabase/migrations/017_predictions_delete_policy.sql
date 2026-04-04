-- Allow users to delete their own unresolved predictions (e.g. remove a pre-match bet)
drop policy if exists "predictions_delete_own" on predictions;
create policy "predictions_delete_own"
  on predictions for delete
  using (user_id = auth.uid() and is_resolved = false);
