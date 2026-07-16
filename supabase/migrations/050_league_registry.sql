-- ─── Migration 050: league_registry table (V4 Sprint 28 Commit 1) ──────────
-- "Dynamic Orchestration & Tiered Polling" — replaces the two hand-maintained
-- TS maps (backend espn.ts's LEAGUE_ESPN_MAP, frontend constants.ts's
-- LEAGUE_ESPN_SLUG) as the single source of truth for which leagues the
-- backend sync worker knows about and how aggressively it polls each one.
--
-- This migration is additive only — a brand new table, zero locks on
-- `matches`/`predictions`. The seed below mirrors the CURRENT 15-entry
-- LEAGUE_ESPN_MAP exactly (verified against the live file, not guessed) so
-- this ships with zero behavior change until Commit 2 wires the backend to
-- actually read from it. League 4467 (Euro Championship) is deliberately
-- NOT seeded — it exists in the frontend's display list but has no working
-- ESPN slug today (already documented as "silently skipped" in CLAUDE.md
-- §13); seeding a row with a fake espn_slug would misrepresent it as
-- pollable when it isn't.
--
-- Idempotent: CREATE TABLE/POLICY/INDEX IF NOT EXISTS, seed uses
-- ON CONFLICT (id) DO NOTHING. Safe to re-run.

CREATE TABLE IF NOT EXISTS league_registry (
  id               INTEGER PRIMARY KEY,
  espn_slug        TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  display_name_he  TEXT,
  espn_logo_id     INTEGER,              -- nullable: league 5000 has no real ESPN logo today
  priority_tier    TEXT NOT NULL DEFAULT 'standard'
                     CHECK (priority_tier IN ('live_tier1','standard','low_frequency')),
  enabled          BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-sensitive config data (same trust level as league names/logos already
-- public today via `matches`) — public read, service-role-only write. No
-- client-facing INSERT/UPDATE/DELETE policy at all: this table is backend-
-- managed, not user-editable, same posture as `matches` itself.
ALTER TABLE league_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_registry_read_all ON league_registry;
CREATE POLICY league_registry_read_all
  ON league_registry FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_league_registry_enabled_tier
  ON league_registry(enabled, priority_tier);

-- Seed: the current 15 ESPN-covered leagues (backend/src/services/espn.ts's
-- LEAGUE_ESPN_MAP), carrying real slugs/names/logo IDs already proven live in
-- production. Tier assignments are a reasonable starting default — top-5
-- leagues + Champions League as the fast base tier, domestic cups/Europa/
-- Conference/Nations League/World Cup as standard, high-volume/low-profile
-- friendlies + infrequent qualifiers as low_frequency — editable via this
-- table going forward without a code deploy. World Cup (4480) is
-- deliberately `standard`, not `live_tier1`: Sprint 28 Commit 3's live-match
-- promotion bumps it to fast cadence automatically once a real WC match is
-- live, without needing a permanently-elevated base tier for the 11 months a
-- year it's dormant.
INSERT INTO league_registry (id, espn_slug, display_name, display_name_he, espn_logo_id, priority_tier) VALUES
  (4328, 'eng.1',            'Premier League',            'פרימייר ליג',       23,    'live_tier1'),
  (4335, 'esp.1',            'La Liga',                    'לה ליגה',           15,    'live_tier1'),
  (4331, 'ger.1',            'Bundesliga',                  'בונדסליגה',         10,    'live_tier1'),
  (4332, 'ita.1',            'Serie A',                     'הליגה האיטלקית',    12,    'live_tier1'),
  (4334, 'fra.1',            'Ligue 1',                     'ליג 1',             9,     'live_tier1'),
  (4346, 'uefa.champions',   'Champions League',            'ליגת האלופות',      2,     'live_tier1'),
  (4399, 'uefa.europa',      'Europa League',                'ליגת אירופה',       2310,  'standard'),
  (4877, 'uefa.europa.conf', 'Conference League',            'ליגת הקונפרנס',     20296, 'standard'),
  (9001, 'eng.fa',           'FA Cup',                       'גביע ה-FA',         40,    'standard'),
  (9002, 'eng.league_cup',   'League Cup',                   'גביע הליגה',        41,    'standard'),
  (9003, 'esp.copa_del_rey', 'Copa del Rey',                 'קופה דל ריי',       80,    'standard'),
  (4635, 'uefa.nations',     'Nations League',               'ליגת האומות',       2395,  'standard'),
  (4480, 'fifa.world',       'World Cup',                    'מונדיאל',           4,     'standard'),
  (4396, 'fifa.friendly',    'International Friendlies',     'משחקי ידידות',      53,    'low_frequency'),
  (5000, 'uefa.worldq',      'World Cup Qualifiers',         'מוקדמות המונדיאל',  NULL,  'low_frequency')
ON CONFLICT (id) DO NOTHING;
