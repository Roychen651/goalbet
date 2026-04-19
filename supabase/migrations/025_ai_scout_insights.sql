-- AI Scout insights (Sprint 26)
-- Generated once on the backend (Groq / Llama 3), served infinitely from DB.
-- Both columns are nullable — frontend MUST hide UI when null
-- (graceful degradation if Groq API fails, rate-limits, or is disabled).
alter table matches
  add column if not exists ai_pre_match_insight text,
  add column if not exists ai_post_match_summary text;
