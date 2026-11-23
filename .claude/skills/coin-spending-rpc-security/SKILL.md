---
name: coin-spending-rpc-security
description: Use before writing ANY new Supabase RPC/SQL function that reads, debits, credits, or otherwise moves a coin/balance value (group_members.coins, any ledger insert, any two-party transfer). Also use when reviewing an existing coin-spending RPC for a security regression. Covers the mandatory auth.uid()-first check, server-computed amounts, atomicity, lock ordering, and the two-phase-commit pattern for two-party transactions.
---

# Coin-Spending RPC Security

GoalBet's coin economy has been the target of real, found-and-fixed
vulnerabilities more than once (§11, §27). This skill is the checklist that
makes every NEW coin-spending RPC follow the same hardened shape from day
one, instead of being retrofitted after a real exploit.

## The mandatory shape — every item, every time, no exceptions

1. **`auth.uid()` check FIRST, as the function's very first action.**
   ```sql
   -- ❌ Never trust a client-supplied user id for whose coins move
   CREATE FUNCTION spend_coins(p_user_id uuid, p_amount int) ...

   -- ✅ First line of the function body
   IF p_user_id IS DISTINCT FROM auth.uid() THEN
     RAISE EXCEPTION 'Access denied';
   END IF;
   ```
   This is the SAME discipline `is_super_admin()` enforces for every admin
   RPC (rule 4.11) — never make an exception for a "simpler" coin RPC.

2. **The cost/amount is ALWAYS computed server-side from data the RPC itself
   reads — never from a client-supplied parameter.**
   ```sql
   -- ❌ The client could pass p_cost = 1 for a bet that should cost 19
   CREATE FUNCTION place_bet(p_user_id uuid, p_cost int) ...

   -- ✅ Look up the real cost inside the function, from the actual tier/item
   -- the client is choosing by ID — never a price it asserts.
   SELECT cost INTO v_real_cost FROM cosmetic_catalog WHERE item_id = p_item_id;
   ```
   `place_prediction_bet`/`adjust_prediction_bet` (migration 020/021) were
   both DROPPED OUTRIGHT in migration 040 specifically because they trusted a
   client-supplied cost — a deprecated vulnerable RPC must be dropped, not
   just stopped-being-called from the frontend, or it's still reachable via a
   direct `supabase.rpc()` call.

3. **The entire write — balance debit/credit AND the ledger row AND the
   domain row itself — happens in ONE atomic SQL function.** The client never
   writes a spending-adjacent table directly. No "optimistic client insert,
   then an RPC just adjusts the balance" split — that's exactly the second,
   independent vulnerability §27 found (a client writing `coins_bet` directly
   via `.upsert()`, with no way to verify it matched what the RPC actually
   charged).

4. **Lock-ordering discipline, when a transaction touches both a contended
   shared row and a single-party balance row:** lock the contended shared row
   FIRST (`FOR UPDATE`), then the balance row. This is what closes the race
   between a concurrent state-transition and a last-second action on the same
   resource — see `accept_duel_wager()` (migration 065, §62): it locks the
   duel row before debiting the acceptor's own balance, closing the race
   between two members racing to accept the same open offer. Also see rule
   4.17 — a `FOR UPDATE`/`FOR SHARE`-protected transaction must never span an
   unbounded-duration operation (no HTTP calls, no unbounded loops) while
   holding that lock.

5. **Never suppress a uniqueness-violation with `ON CONFLICT DO NOTHING` once
   a PRIOR step in the same function has already moved money.** Let the
   constraint violation raise and roll back the WHOLE transaction — including
   the coin debit that already happened earlier in the same call. Silently
   swallowing it after money already moved strands the side effect with no
   row to show for it. (`submit_micro_prediction()`, §29, is the reference
   case for getting this right: a real `UNIQUE(question_id, user_id)`
   violation is allowed to raise and roll back everything, including the
   coin deduction, rather than being wrapped in `ON CONFLICT DO NOTHING`.)

6. **Two-party transactions need a genuine two-phase commit — never one
   call moving a second party's balance based on an unverifiable client
   assertion about that party's intent.** A single RPC that debits BOTH the
   caller's balance AND some other user's balance based on nothing but an
   ephemeral/client-authored message (a broadcast payload, a spoofable
   "fromUserId" field) reopens rule 4.11's original vulnerability class one
   level up: anyone could fabricate a fake "offer," then "accept" their own
   forgery and drain a fabricated victim. The correct pattern (Live Duels,
   §62, migration 065):
   - The CHALLENGER's own authenticated call debits ONLY their own balance
     and creates a real, persisted row (`create_duel_offer()`).
   - The ACCEPTOR's own authenticated call, SEPARATELY, debits ONLY their own
     balance and activates the already-persisted row
     (`accept_duel_wager()`).
   - Neither RPC ever moves a second party's coins based on anything the
     client asserts about that party — only each party's own `auth.uid()`
     call ever touches that party's own balance.

7. **A full, net amount is computed up front — never award-the-full-amount-
   then-claw-back.** When a payout has a deduction (a royalty, a fee), the
   RECIPIENT's own award is the already-net amount in a single
   `increment_coins` call; any secondary beneficiary's cut is a SEPARATE,
   independent, best-effort credit gated on the primary award having
   succeeded — never the other way around, and a failure in the secondary
   credit must never roll back the primary award. (See `scoreUpdater.ts`'s
   `awardCoinsWithRoyalty()` helper, §62/§75 Sprint A.)

## Quick self-check before shipping a new coin-spending RPC

1. Is `auth.uid()` checked, as the literal first statement?
2. Does every dollar amount in this function come from a `SELECT` against a
   real table/catalog, never from a function parameter?
3. Does the client write to any spending-adjacent table directly, or does
   this one RPC own the entire write?
4. If this transaction touches a shared contended row, is it locked BEFORE
   any balance row, and does the transaction stay short/bounded?
5. If this is a two-party transaction, does EACH party's own balance only
   ever move via that same party's own authenticated call?
6. Is a deprecated, replaced RPC actually `DROP`ped, not just abandoned?
