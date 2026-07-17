-- ─── Migration 057: Profile Prestige & Cosmetics (V5 Sprint 37 Commit 1) ──
-- Two new profiles columns (unlocked_cosmetics, active_cosmetics), a new
-- cosmetic_catalog table (the RPC's own authoritative price source — never
-- trust a client-supplied cost, rule §11/§27), a column-level REVOKE
-- closing the "any user can self-grant cosmetics via a direct .update()"
-- gap the blanket profiles_update_own RLS policy would otherwise leave
-- open, a widened coin_transactions.type CHECK, and two RPCs
-- (purchase_cosmetic_item, equip_cosmetic). Idempotent.

-- ============================================================
-- 1. profiles columns
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unlocked_cosmetics TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS active_cosmetics   JSONB  NOT NULL DEFAULT '{}'::jsonb;

-- The existing profiles_update_own policy (migration 002) is a blanket
-- row-level `auth.uid() = id` check with NO column restriction — correct
-- for username/gender/avatar_url, but these two new columns directly
-- encode "what did this user pay for." Without this REVOKE, any
-- authenticated user could grant themselves every cosmetic for free via a
-- plain supabase.from('profiles').update() call, completely bypassing
-- purchase_cosmetic_item() below. Both RPCs below are SECURITY DEFINER —
-- they execute as the function owner, not as `authenticated`, so this
-- REVOKE never blocks them.
REVOKE UPDATE (unlocked_cosmetics, active_cosmetics) ON public.profiles FROM authenticated;

-- ============================================================
-- 2. cosmetic_catalog — the RPC's own authoritative price/availability
--    source. The frontend keeps a parallel static TS catalog for
--    presentation metadata (name, icon, rarity color) keyed by the same
--    item_id — that copy is display-only and is never trusted for price.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cosmetic_catalog (
  item_id    TEXT PRIMARY KEY,
  slot       TEXT NOT NULL CHECK (slot IN ('frame', 'halo', 'badge')),
  cost       INTEGER NOT NULL CHECK (cost > 0),
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cosmetic_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cosmetic_catalog_select_all" ON public.cosmetic_catalog;
CREATE POLICY "cosmetic_catalog_select_all" ON public.cosmetic_catalog
  FOR SELECT USING (true);
-- No client INSERT/UPDATE/DELETE policy — service-role (or a future admin
-- RPC) only, same posture as league_registry (migration 050, §43).

-- Idempotent seed — matches lib/cosmeticsCatalog.ts (frontend, Commit 2)
-- item_id-for-item_id. If these two ever drift, the RPC's price is always
-- what actually gets charged; the frontend catalog is presentation only.
INSERT INTO public.cosmetic_catalog (item_id, slot, cost) VALUES
  ('frame_neon',        'frame', 350),
  ('frame_cyber_gold',  'frame', 500),
  ('frame_frost',       'frame', 500),
  ('halo_emerald_pulse','halo',  1000),
  ('halo_royal_violet', 'halo',  1000),
  ('halo_crimson_flare','halo',  1200),
  ('badge_founder',     'badge', 250),
  ('badge_sharpshooter','badge', 400)
ON CONFLICT (item_id) DO NOTHING;

-- ============================================================
-- 3. coin_transactions.type — widen to allow 'cosmetic_purchase'.
--    Auto-generated constraint name from the inline CHECK in migration 020
--    (same naming convention already proven for group_events_event_type_check
--    in migrations 039/042/055/056).
-- ============================================================
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN ('join_bonus', 'daily_bonus', 'bet_placed', 'bet_won', 'cosmetic_purchase'));

-- ============================================================
-- 4. purchase_cosmetic_item — the sole write path for unlocking a
--    cosmetic. auth.uid() first (no p_user_id param — matches this
--    schema's established shape since migration 040, structurally
--    impossible to spoof since there's no parameter to mismatch). Price
--    comes from cosmetic_catalog, never from the client. p_group_id is
--    required because coins only exist per-group (rule 4.12) — the
--    unlock itself is profile-wide, but payment must come from a specific
--    group's balance.
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_cosmetic_item(
  p_item_id  TEXT,
  p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_cost      INTEGER;
  v_unlocked  TEXT[];
  v_coins     INTEGER;
  v_balance   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  -- 1. Authoritative price lookup — never trust a client-supplied cost.
  SELECT cost INTO v_cost FROM cosmetic_catalog WHERE item_id = p_item_id AND enabled = true;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'item_not_found');
  END IF;

  -- 2. Cheap pre-check — avoids locking/debiting a balance at all for the
  --    common "already own it" case. This is NOT the atomic guarantee
  --    (see step 5) — just an optimization.
  SELECT unlocked_cosmetics INTO v_unlocked FROM profiles WHERE id = v_user_id;
  IF p_item_id = ANY(v_unlocked) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_unlocked');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  -- 3. Lock + debit the balance (rule 4.17's lock-ordering discipline —
  --    this is the one row lock in this function, taken before any
  --    further writes).
  SELECT coins INTO v_coins FROM group_members
   WHERE user_id = v_user_id AND group_id = p_group_id FOR UPDATE;

  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_coins < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  UPDATE group_members SET coins = coins - v_cost
   WHERE user_id = v_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions (user_id, group_id, type, amount, balance_after, description)
  VALUES (v_user_id, p_group_id, 'cosmetic_purchase', -v_cost, v_balance, 'Unlocked cosmetic: ' || p_item_id);

  -- 4. The real atomic guard against a genuine concurrent double-purchase
  --    of the SAME item (two simultaneous calls both passing step 2's
  --    pre-check before either commits). If this matches 0 rows, RAISE to
  --    roll back the ENTIRE transaction — including the coin debit above
  --    — rather than silently leaving a paid-for-but-unwritten purchase.
  UPDATE profiles SET unlocked_cosmetics = array_append(unlocked_cosmetics, p_item_id)
   WHERE id = v_user_id AND NOT (p_item_id = ANY(unlocked_cosmetics));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concurrent purchase detected for item %, transaction rolled back', p_item_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance, 'item_id', p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_cosmetic_item(TEXT, UUID) TO authenticated;

-- ============================================================
-- 5. equip_cosmetic — free, no coins involved. Server-side ownership
--    check is the entire point of this RPC existing (a direct client
--    write to active_cosmetics, even if the REVOKE above didn't block it,
--    could equip something never purchased).
-- ============================================================
CREATE OR REPLACE FUNCTION public.equip_cosmetic(
  p_slot    TEXT,
  p_item_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_unlocked TEXT[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF p_slot NOT IN ('frame', 'halo', 'badge') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slot');
  END IF;

  IF p_item_id IS NOT NULL THEN
    SELECT unlocked_cosmetics INTO v_unlocked FROM profiles WHERE id = v_user_id;
    IF NOT (p_item_id = ANY(v_unlocked)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_unlocked');
    END IF;
  END IF;

  -- to_jsonb(NULL::text) evaluates to SQL NULL (not the JSON `null`
  -- literal), and jsonb_set() with a NULL new_value argument returns NULL
  -- — which would wipe active_cosmetics to NULL entirely and violate its
  -- NOT NULL constraint on an unequip. COALESCE to the real JSON null
  -- literal so an unequip only clears this one slot.
  UPDATE profiles
     SET active_cosmetics = jsonb_set(active_cosmetics, ARRAY[p_slot], COALESCE(to_jsonb(p_item_id), 'null'::jsonb), true)
   WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'slot', p_slot, 'item_id', p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_cosmetic(TEXT, TEXT) TO authenticated;
