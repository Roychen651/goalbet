-- Allow users to delete their own unresolved predictions (e.g. remove a pre-match bet)
create policy "predictions_delete_own"
  on predictions for delete
  using (user_id = auth.uid() and is_resolved = false);
