/**
 * Shared ESPN HTTP client — V4 Sprint 30 Commit 2.
 *
 * A DEDICATED axios instance (axios.create()), not the bare default axios
 * import — aiScout.ts's Groq client uses that same default import for its
 * own axios.post() calls, and a global axios.interceptors.* on the default
 * export would silently start retrying Groq requests too. Groq already has
 * its own timeout/error-swallow discipline (§22); this module must not
 * reach into it. Every ESPN-calling file (espn.ts, stats.ts, leagueNews.ts)
 * imports espnGet() from here instead of calling axios.get() directly.
 *
 * Two responsibilities, composed in espnGet():
 *   1. Concurrency — every call runs through the process-wide espnLimiter
 *      (concurrencyLimiter.ts), so no scheduling layer (Tier-1/Tier-2
 *      pollers, daily sync, registry refresh, backfill script) can push the
 *      AGGREGATE in-flight ESPN request count past the configured ceiling,
 *      regardless of how many of them fire in the same few seconds.
 *   2. Retry — exponential backoff with ADDITIVE jitter (not AWS's
 *      multiplicative "decorrelated jitter" — that formula doesn't produce
 *      the clean ~1s/~2s/~4s doubling this sprint's own spec calls for).
 *      Retries ONLY on 429, 5xx, or a genuine network/timeout error (no
 *      `error.response` at all). Every other 4xx (404 wrong slug, 400 bad
 *      request, 403 forbidden) fails immediately — retrying those just
 *      delays the inevitable and burns the retry budget on a request that
 *      will never succeed.
 */

import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { espnLimiter } from './concurrencyLimiter';
import { logger } from './logger';

const espnAxios = axios.create();

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const JITTER_CEILING_MS = 1000;

function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // network error / timeout — no response received at all
  const status = error.response.status;
  return status === 429 || (status >= 500 && status < 600);
}

// Temporary diagnostic — Nov 2026: every ESPN call started returning 400
// after ~4 months of this backend being dormant, and every existing catch
// site only ever logged `err.message` ("Request failed with status code
// 400"), never the actual response body/headers ESPN sent back. Logs the
// real body (truncated) + a few block/rate-limit-relevant headers exactly
// once per failed request, right before it's rejected to the caller —
// never on a successful retry, never twice for the same attempt.
function logEspnFailureDetail(error: AxiosError): void {
  const status = error.response?.status ?? 'network';
  const url = error.config?.url ?? 'unknown-url';
  const headers = error.response?.headers ?? {};
  const interestingHeaders = {
    server: headers['server'],
    'cf-ray': headers['cf-ray'],
    'cf-mitigated': headers['cf-mitigated'],
    'content-type': headers['content-type'],
    'retry-after': headers['retry-after'],
    'x-envoy-ratelimited': headers['x-envoy-ratelimited'],
  };
  let bodyPreview = '';
  try {
    const raw = typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data ?? '');
    bodyPreview = raw.slice(0, 500);
  } catch {
    bodyPreview = '[unstringifiable body]';
  }
  logger.error(`[ESPN][diagnostic] ${status} on ${url} — headers=${JSON.stringify(interestingHeaders)} body=${bodyPreview}`);
}

type RetryableConfig = InternalAxiosRequestConfig & { __retryCount?: number };

espnAxios.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetryableConfig | undefined;
  if (!config || !isRetryable(error)) {
    logEspnFailureDetail(error);
    return Promise.reject(error);
  }

  config.__retryCount = (config.__retryCount ?? 0) + 1;
  if (config.__retryCount > MAX_RETRIES) {
    logEspnFailureDetail(error);
    return Promise.reject(error);
  }

  // base * 2^attempt: 1s, 2s, 4s — plus additive jitter so many concurrent
  // retries scheduled around the same moment don't all re-fire in lockstep.
  const backoff = BASE_DELAY_MS * 2 ** (config.__retryCount - 1);
  const jitter = Math.random() * JITTER_CEILING_MS;
  logger.debug(`[espnHttp] retry ${config.__retryCount}/${MAX_RETRIES} for ${config.url} after ${Math.round(backoff + jitter)}ms (status=${error.response?.status ?? 'network'})`);
  await new Promise(resolve => setTimeout(resolve, backoff + jitter));

  return espnAxios(config);
});

export async function espnGet<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
  return espnLimiter.run(async () => {
    const res = await espnAxios.get<T>(url, options);
    return res.data;
  });
}
