-- Sprint 26 follow-up: Hebrew variants for AI Scout insights.
-- Generated independently by the backend so Hebrew users see native copy
-- without runtime translation (preserves "Compute Once, Serve Infinite").

alter table matches
  add column if not exists ai_pre_match_insight_he text,
  add column if not exists ai_post_match_summary_he text;
