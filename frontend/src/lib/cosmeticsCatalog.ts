// V5 Sprint 37 — "Profile Prestige & Cosmetics". Presentation-only catalog
// metadata (name, color tokens, description) keyed by the same item_id the
// DB's cosmetic_catalog table (migration 057) uses for price/availability.
// `cost` here is shown for the optimistic UI only — purchase_cosmetic_item()
// never trusts it; the RPC always re-reads the authoritative price from the
// DB table. If these two ever drift, the RPC's number is what's actually
// charged (same "keep both in sync by a shared key, never let the client
// copy be trusted" discipline as COIN_COSTS/migration 040, §11).

export type CosmeticSlot = 'frame' | 'halo' | 'badge';

export interface CosmeticItem {
  itemId: string;
  slot: CosmeticSlot;
  cost: number;
  nameEn: string;
  nameHe: string;
  /** Primary color driving the frame/halo/badge render — a CSS color or gradient stop. */
  color: string;
  /** Secondary color for a two-stop gradient (frames/halos only). */
  colorSecondary?: string;
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  {
    itemId: 'frame_neon',
    slot: 'frame',
    cost: 350,
    nameEn: 'Neon Frame',
    nameHe: 'מסגרת ניאון',
    color: '#39FF88',
    colorSecondary: '#00D4FF',
  },
  {
    itemId: 'frame_cyber_gold',
    slot: 'frame',
    cost: 500,
    nameEn: 'Cyber Gold Frame',
    nameHe: 'מסגרת זהב סייבר',
    color: '#F5C518',
    colorSecondary: '#FF9D3D',
  },
  {
    itemId: 'frame_frost',
    slot: 'frame',
    cost: 500,
    nameEn: 'Frost Frame',
    nameHe: 'מסגרת קרח',
    color: '#BDE8F5',
    colorSecondary: '#4988C4',
  },
  {
    itemId: 'halo_emerald_pulse',
    slot: 'halo',
    cost: 1000,
    nameEn: 'Emerald Pulse Halo',
    nameHe: 'הילת אזמרגד פועמת',
    color: '#34D399',
  },
  {
    itemId: 'halo_royal_violet',
    slot: 'halo',
    cost: 1000,
    nameEn: 'Royal Violet Halo',
    nameHe: 'הילה סגולה מלכותית',
    color: '#A78BFA',
  },
  {
    itemId: 'halo_crimson_flare',
    slot: 'halo',
    cost: 1200,
    nameEn: 'Crimson Flare Halo',
    nameHe: 'הילת להבת ארגמן',
    color: '#FF4D66',
  },
  {
    itemId: 'badge_founder',
    slot: 'badge',
    cost: 250,
    nameEn: 'Founder Badge',
    nameHe: 'תג מייסד',
    color: '#F5C518',
  },
  {
    itemId: 'badge_sharpshooter',
    slot: 'badge',
    cost: 400,
    nameEn: 'Sharpshooter Badge',
    nameHe: 'תג צלף',
    color: '#60A5FA',
  },
];

export function getCosmeticItem(itemId: string | null | undefined): CosmeticItem | null {
  if (!itemId) return null;
  return COSMETIC_CATALOG.find((c) => c.itemId === itemId) ?? null;
}

export const COSMETIC_SLOTS: CosmeticSlot[] = ['frame', 'halo', 'badge'];
