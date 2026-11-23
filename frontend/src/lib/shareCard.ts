/**
 * shareCard — zero-dependency shareable recap card.
 *
 * Same philosophy as Sparkline.tsx (Sprint 9): a hand-drawn Canvas primitive
 * instead of a screenshot library (html2canvas / html-to-image). Colors are
 * resolved from the live CSS custom properties via getComputedStyle at the
 * exact moment the card is drawn, so the exported PNG matches whichever theme
 * (Navy/Frost) is currently active — zero hardcoded hex, zero dark/light
 * branching.
 */

export interface RecapCardData {
  username: string;
  rank: number;
  totalPoints: number;
  streak: number;
  lang: 'en' | 'he';
}

const CARD_W = 1080;
const CARD_H = 1350;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Accepts either '#rrggbb' or 'rgba(...)' — both are real values our CSS vars
// take (see index.css) — and returns an rgba() string at the given alpha.
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const nums = color.match(/[\d.]+/g);
    if (nums && nums.length >= 3) return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha})`;
  }
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return color;
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function shade(color: string, percent: number): string {
  if (!color.startsWith('#')) return color;
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  if (Number.isNaN(num)) return color;
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(2.55 * percent);
  let b = (num & 0x0000ff) + Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Draws the recap card to an offscreen canvas and returns it. Canvas text has
 * no concept of CSS logical properties, so RTL is handled explicitly
 * (ctx.direction + right-anchored layout) — mirroring the manual dir={isRTL
 * ? 'rtl' : 'ltr'} pattern already used in HTAnalystCard/AiBanterCard.
 */
export function drawRecapCard(data: RecapCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isHe = data.lang === 'he';
  ctx.direction = isHe ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';

  // Resolved at draw time — this is what makes the PNG theme-accurate.
  const bgBase = cssVar('--color-bg-base', '#0a1733');
  const accent = cssVar('--color-accent-green', '#BDE8F5');
  const textPrimary = cssVar('--color-text-primary', '#FFFFFF');
  const borderBright = cssVar('--color-border-bright', 'rgba(189,232,245,0.40)');

  // Background: diagonal gradient bg-base -> a darker shade.
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, bgBase);
  bgGrad.addColorStop(1, shade(bgBase, -14));
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 48);
  ctx.fill();

  // Accent bloom, echoing the app's own body-background bloom treatment (§15).
  const bloom = ctx.createRadialGradient(CARD_W / 2, CARD_H - 120, 0, CARD_W / 2, CARD_H - 120, 480);
  bloom.addColorStop(0, withAlpha(accent, 0.20));
  bloom.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Border
  ctx.strokeStyle = borderBright;
  ctx.lineWidth = 3;
  roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 44);
  ctx.stroke();

  const cx = CARD_W / 2;

  // Wordmark
  ctx.fillStyle = accent;
  ctx.font = '700 40px sans-serif';
  ctx.fillText('GoalBet ⚽', cx, 130);

  // Username
  ctx.fillStyle = textPrimary;
  ctx.font = '600 44px sans-serif';
  ctx.fillText(data.username, cx, 230);

  // Rank — hero number
  ctx.fillStyle = accent;
  ctx.font = '800 260px sans-serif';
  ctx.fillText(`#${data.rank}`, cx, 620);

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = textPrimary;
  ctx.font = '500 34px sans-serif';
  ctx.fillText(isHe ? 'מקום בקבוצה' : 'in your group', cx, 690);
  ctx.globalAlpha = 1;

  // Points + streak row
  const rowY = 900;
  ctx.font = '800 88px sans-serif';
  ctx.fillStyle = textPrimary;
  ctx.fillText(String(data.totalPoints), cx - 220, rowY);
  ctx.globalAlpha = 0.6;
  ctx.font = '500 30px sans-serif';
  ctx.fillText(isHe ? 'נקודות' : 'POINTS', cx - 220, rowY + 50);
  ctx.globalAlpha = 1;

  ctx.font = '800 88px sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(`${data.streak}🔥`, cx + 220, rowY);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = textPrimary;
  ctx.font = '500 30px sans-serif';
  ctx.fillText(isHe ? 'רצף' : 'STREAK', cx + 220, rowY + 50);
  ctx.globalAlpha = 1;

  // Footer
  ctx.globalAlpha = 0.4;
  ctx.font = '500 28px sans-serif';
  ctx.fillStyle = textPrimary;
  ctx.fillText('goalbet.io', cx, CARD_H - 70);
  ctx.globalAlpha = 1;

  return canvas;
}

// ─── New engagement features — "Share a Pick" (self-only, pre-kickoff) ────
//
// Privacy boundary (re-read before touching this): predictions are hidden
// from OTHER group members pre-kickoff under migration 037's RLS wall
// (§27/§14). This card draws ONLY from the current user's own already-
// fetched prediction row (PredictionForm's own local state, sourced from
// usePredictions.ts's optimistic cache) — never a server round-trip that
// could leak a different user's pick, and never rendered for anyone but
// the row's own owner. There is no cross-user transmission at all here
// (unlike §62's Blind Tail, which has to pass a prediction *id* through a
// server-side RPC specifically to avoid exposing a value client-side —
// this feature never needs that machinery because it's self-only by
// construction: the data never leaves the owning user's own browser until
// THEY tap share).

export interface PredictionShareCardData {
  homeTeam: string;
  awayTeam: string;
  /** Localized team names (tTeam()) are resolved by the caller — this file
   *  has no i18n dependency of its own, matching drawRecapCard's shape. */
  predictedOutcome: 'H' | 'D' | 'A' | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  kickoffTime: string;
  username: string;
  lang: 'en' | 'he';
}

/**
 * Draws a single-pick share card — same Canvas-primitive philosophy as
 * drawRecapCard() (no screenshot library, colors resolved live via
 * getComputedStyle so the PNG matches the active theme, explicit RTL via
 * ctx.direction + right-anchored layout). Deliberately a SEPARATE function,
 * not a drawRecapCard() variant — the two cards show structurally different
 * data (a season rank vs. a single match pick) and keeping them separate
 * avoids a single function growing a pile of "if this field is set, else
 * that one" branches.
 */
export function drawPredictionShareCard(data: PredictionShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isHe = data.lang === 'he';
  ctx.direction = isHe ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';

  const bgBase = cssVar('--color-bg-base', '#0a1733');
  const accent = cssVar('--color-accent-green', '#BDE8F5');
  const textPrimary = cssVar('--color-text-primary', '#FFFFFF');
  const borderBright = cssVar('--color-border-bright', 'rgba(189,232,245,0.40)');

  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, bgBase);
  bgGrad.addColorStop(1, shade(bgBase, -14));
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 48);
  ctx.fill();

  const bloom = ctx.createRadialGradient(CARD_W / 2, 420, 0, CARD_W / 2, 420, 480);
  bloom.addColorStop(0, withAlpha(accent, 0.18));
  bloom.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = borderBright;
  ctx.lineWidth = 3;
  roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 44);
  ctx.stroke();

  const cx = CARD_W / 2;

  // Wordmark + "my pick" eyebrow
  ctx.fillStyle = accent;
  ctx.font = '700 40px sans-serif';
  ctx.fillText('GoalBet ⚽', cx, 120);

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = textPrimary;
  ctx.font = '600 30px sans-serif';
  ctx.fillText(isHe ? `הניחוש של ${data.username}` : `${data.username}'s pick`, cx, 175);
  ctx.globalAlpha = 1;

  // Teams — "Home vs Away" as two stacked lines so a long name never
  // overflows the fixed 1080px card width.
  ctx.fillStyle = textPrimary;
  ctx.font = '700 58px sans-serif';
  ctx.fillText(data.homeTeam, cx, 320);
  ctx.globalAlpha = 0.5;
  ctx.font = '600 32px sans-serif';
  ctx.fillText(isHe ? 'מול' : 'vs', cx, 375);
  ctx.globalAlpha = 1;
  ctx.font = '700 58px sans-serif';
  ctx.fillText(data.awayTeam, cx, 445);

  // The pick itself — the hero element, exactly like the recap card's rank.
  const hasScore = data.predictedHomeScore !== null && data.predictedAwayScore !== null;
  if (hasScore) {
    ctx.fillStyle = accent;
    ctx.font = '800 220px sans-serif';
    ctx.fillText(`${data.predictedHomeScore}–${data.predictedAwayScore}`, cx, 760);
  } else if (data.predictedOutcome) {
    const outcomeText =
      data.predictedOutcome === 'H' ? data.homeTeam
      : data.predictedOutcome === 'A' ? data.awayTeam
      : (isHe ? 'שוויון' : 'Draw');
    ctx.fillStyle = accent;
    ctx.font = '800 100px sans-serif';
    // A team name can run long — clamp the font progressively rather than
    // letting it overflow the card's fixed width (Canvas has no text-wrap).
    let fontSize = 100;
    while (ctx.measureText(outcomeText).width > CARD_W - 160 && fontSize > 48) {
      fontSize -= 6;
      ctx.font = `800 ${fontSize}px sans-serif`;
    }
    ctx.fillText(outcomeText, cx, 740);
  }

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = textPrimary;
  ctx.font = '500 34px sans-serif';
  ctx.fillText(isHe ? 'הניחוש שלי' : 'MY PREDICTION', cx, hasScore ? 900 : 830);
  ctx.globalAlpha = 1;

  // Kickoff time footer
  const kickoff = new Date(data.kickoffTime);
  const kickoffLabel = kickoff.toLocaleString(isHe ? 'he-IL' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  ctx.globalAlpha = 0.45;
  ctx.font = '500 30px sans-serif';
  ctx.fillText(kickoffLabel, cx, 1110);
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.4;
  ctx.font = '500 28px sans-serif';
  ctx.fillText('goalbet.io', cx, CARD_H - 70);
  ctx.globalAlpha = 1;

  return canvas;
}

export type ShareOutcome = 'shared-file' | 'shared-text' | 'copied' | 'downloaded' | 'cancelled';

/**
 * Three-tier share fallback:
 *  1. navigator.share with a file — rich image share into WhatsApp/iMessage.
 *  2. navigator.share text-only — some browsers support share() without file support.
 *  3. clipboard copy of the share text + an explicit image download — desktop
 *     browsers and webviews that lack the Web Share API entirely.
 */
export async function shareRecapCard(
  canvas: HTMLCanvasElement,
  shareText: string,
  shareTitle: string,
): Promise<ShareOutcome> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

  if (blob) {
    const file = new File([blob], 'goalbet-recap.png', { type: 'image/png' });
    const canShareFiles =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    if (canShareFiles && navigator.share) {
      try {
        await navigator.share({ files: [file], title: shareTitle, text: shareText });
        return 'shared-file';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return 'cancelled';
        // fall through to the next tier
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText });
      return 'shared-text';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // fall through to the final tier
    }
  }

  try {
    await navigator.clipboard.writeText(shareText);
  } catch {
    // clipboard permission can fail silently — the download below still helps
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goalbet-recap.png';
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }

  return 'copied';
}
