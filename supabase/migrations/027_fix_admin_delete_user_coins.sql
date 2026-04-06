-- ============================================================
-- 027: Fix admin delete RPCs — remove references to user_coins
-- user_coins table was never created; coins live in
-- group_members.coins and coin_transactions (which cascades).
-- ============================================================

-- ── Delete group (full cascade) ───────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  -- coin_transactions cascades on groups(id) ON DELETE CASCADE
  DELETE FROM public.leaderboard   WHERE group_id = p_group_id;
  DELETE FROM public.predictions   WHERE group_id = p_group_id;
  DELETE FROM public.group_members WHERE group_id = p_group_id;
  DELETE FROM public.groups        WHERE id       = p_group_id;
END;
$$;

-- ── Wipe user data (before auth.users deletion via backend) ───
CREATE OR REPLACE FUNCTION admin_delete_user_data(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  -- coin_transactions cascades on profiles(id) ON DELETE CASCADE
  DELETE FROM public.leaderboard   WHERE user_id = p_user_id;
  DELETE FROM public.predictions   WHERE user_id = p_user_id;
  DELETE FROM public.group_members WHERE user_id = p_user_id;
  -- Orphan groups whose only admin was this user
  DELETE FROM public.groups
    WHERE created_by = p_user_id
      AND id NOT IN (SELECT group_id FROM public.group_members);
  DELETE FROM public.profiles      WHERE id = p_user_id;
END;
$$;
