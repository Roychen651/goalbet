-- ============================================================
-- 023: Admin Security Roles & RPCs
-- Only roychen651@gmail.com may execute these functions.
-- All functions are SECURITY DEFINER — they run with elevated
-- privileges but enforce the admin check as their FIRST action.
-- ============================================================

-- ── Helper ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = 'roychen651@gmail.com';
$$;

-- ── Platform stats ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS TABLE (
  total_users          BIGINT,
  total_groups         BIGINT,
  total_matches        BIGINT,
  total_predictions    BIGINT,
  total_coins_circulating BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM auth.users)::BIGINT,
    (SELECT COUNT(*) FROM public.groups)::BIGINT,
    (SELECT COUNT(*) FROM public.matches)::BIGINT,
    (SELECT COUNT(*) FROM public.predictions)::BIGINT,
    (SELECT COALESCE(SUM(coins), 0) FROM public.group_members)::BIGINT;
END;
$$;

-- ── All users ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id               UUID,
  email            TEXT,
  username         TEXT,
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ,
  last_sign_in_at  TIMESTAMPTZ,
  group_count      INT,
  total_coins      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.username,
    p.avatar_url,
    u.created_at,
    u.last_sign_in_at,
    COUNT(DISTINCT gm.group_id)::INT   AS group_count,
    COALESCE(SUM(gm.coins), 0)::BIGINT AS total_coins
  FROM auth.users u
  LEFT JOIN public.profiles      p  ON p.id        = u.id
  LEFT JOIN public.group_members gm ON gm.user_id  = u.id
  GROUP BY u.id, u.email, p.username, p.avatar_url, u.created_at, u.last_sign_in_at
  ORDER BY u.created_at DESC;
END;
$$;

-- ── All groups ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_groups()
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  invite_code    TEXT,
  created_by     UUID,
  admin_username TEXT,
  admin_email    TEXT,
  member_count   INT,
  created_at     TIMESTAMPTZ,
  active_leagues INT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.invite_code,
    g.created_by,
    p.username::TEXT AS admin_username,
    u.email::TEXT    AS admin_email,
    COUNT(DISTINCT gm.user_id)::INT AS member_count,
    g.created_at,
    g.active_leagues
  FROM public.groups g
  LEFT JOIN public.profiles      p  ON p.id        = g.created_by
  LEFT JOIN auth.users           u  ON u.id         = g.created_by
  LEFT JOIN public.group_members gm ON gm.group_id  = g.id
  GROUP BY g.id, g.name, g.invite_code, g.created_by,
           p.username, u.email, g.created_at, g.active_leagues
  ORDER BY g.created_at DESC;
END;
$$;

-- ── User coin balances (per group) ────────────────────────────
-- Reads from group_members.coins — the authoritative coins column.
CREATE OR REPLACE FUNCTION admin_get_user_coins(p_user_id UUID)
RETURNS TABLE (
  group_id   UUID,
  group_name TEXT,
  coins      INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  RETURN QUERY
  SELECT
    gm.group_id,
    g.name::TEXT AS group_name,
    gm.coins
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.user_id = p_user_id
  ORDER BY g.name;
END;
$$;

-- ── Adjust coins (add or subtract, floor at 0) ────────────────
-- Coins live in group_members.coins — same column that increment_coins updates.
CREATE OR REPLACE FUNCTION admin_adjust_coins(
  p_user_id  UUID,
  p_group_id UUID,
  p_delta    INT   -- positive = add, negative = subtract
)
RETURNS INT        -- new balance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  UPDATE public.group_members
  SET coins = GREATEST(0, coins + p_delta)
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_new_balance;

  -- Log the adjustment (wrapped in exception so a log failure never reverts the balance)
  BEGIN
    INSERT INTO public.coin_transactions(user_id, group_id, type, amount, balance_after, description)
    VALUES (p_user_id, p_group_id, 'bet_won', p_delta, v_new_balance,
            'Admin adjustment: ' || CASE WHEN p_delta >= 0 THEN '+' ELSE '' END || p_delta);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN COALESCE(v_new_balance, 0);
END;
$$;

-- ── Update username ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_update_username(
  p_user_id UUID,
  p_username TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  UPDATE public.profiles
  SET username = trim(p_username)
  WHERE id = p_user_id;
END;
$$;

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

  DELETE FROM public.leaderboard    WHERE group_id = p_group_id;
  DELETE FROM public.user_coins     WHERE group_id = p_group_id;
  DELETE FROM public.predictions    WHERE group_id = p_group_id;
  DELETE FROM public.group_members  WHERE group_id = p_group_id;
  DELETE FROM public.groups         WHERE id       = p_group_id;
END;
$$;

-- ── Wipe user data (before auth.users deletion via backend) ───
-- Removes all public-schema rows. The auth.users row is then
-- deleted by the backend service-role API call.
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

  DELETE FROM public.leaderboard    WHERE user_id = p_user_id;
  DELETE FROM public.user_coins     WHERE user_id = p_user_id;
  DELETE FROM public.predictions    WHERE user_id = p_user_id;
  DELETE FROM public.group_members  WHERE user_id = p_user_id;
  -- Orphan groups whose only admin was this user
  DELETE FROM public.groups         WHERE created_by = p_user_id
    AND id NOT IN (SELECT group_id FROM public.group_members);
  DELETE FROM public.profiles       WHERE id = p_user_id;
END;
$$;

-- ── Rename group ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_rename_group(
  p_group_id UUID,
  p_name     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  UPDATE public.groups SET name = trim(p_name) WHERE id = p_group_id;
END;
$$;
