// V5 Sprint 37 — "חנות היוקרה" (Prestige Shop). Swipe-to-close bottom sheet
// (rule 4.13), reusing CoinGuide.tsx's exact shell (drag handle, backdrop,
// card-elevated panel) rather than inventing a new one — same precedent as
// every other sheet in this codebase. Grid grouped by slot (Frame / Halo /
// Prestige Badge — "badge" alone would collide with LeaderboardRow's
// un-persisted badgeHot/badgeSniper pills and TrophyCabinet's own
// un-persisted achievement badges; this is a THIRD, DB-persisted concept,
// named distinctly everywhere in code and copy).
//
// Purchases debit the ACTIVE group's balance (coins only exist per-group,
// rule 4.12) even though the unlock itself is profile-wide — stated
// explicitly in the UI, not left implicit.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { CoinIcon } from '../ui/CoinIcon';
import { COSMETIC_CATALOG, COSMETIC_SLOTS, type CosmeticSlot, type CosmeticItem } from '../../lib/cosmeticsCatalog';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

interface Props {
  onClose: () => void;
}

const SLOT_LABEL_KEY: Record<CosmeticSlot, TranslationKey> = {
  frame: 'slotFrame',
  halo: 'slotHalo',
  badge: 'slotBadge',
};

const PURCHASE_ERROR_KEY: Record<string, TranslationKey> = {
  item_not_found: 'cosmeticErrorGeneric',
  already_unlocked: 'cosmeticErrorAlreadyUnlocked',
  member_not_found: 'cosmeticErrorGeneric',
  insufficient_coins: 'cosmeticErrorInsufficientCoins',
};

const EQUIP_ERROR_KEY: Record<string, TranslationKey> = {
  invalid_slot: 'cosmeticErrorGeneric',
  not_unlocked: 'cosmeticErrorNotUnlocked',
};

export function CosmeticsShopSheet({ onClose }: Props) {
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';
  const { profile, fetchProfile } = useAuthStore();
  const { activeGroupId, groups } = useGroupStore();
  const coinsStore = useCoinsStore();
  const { addToast } = useUIStore();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const activeGroupName = groups.find((g) => g.id === activeGroupId)?.name ?? '';
  const unlocked = new Set(profile?.unlocked_cosmetics ?? []);
  const active = profile?.active_cosmetics ?? {};

  const purchase = async (item: CosmeticItem) => {
    if (!activeGroupId || pendingItemId) return;
    setPendingItemId(item.itemId);
    haptic('selection');
    playSound('toggle_click');
    try {
      const { data, error } = await supabase.rpc('purchase_cosmetic_item', {
        p_item_id: item.itemId,
        p_group_id: activeGroupId,
      });
      if (error) throw error;
      const result = data as { success: boolean; balance?: number; error?: string };
      if (!result.success) {
        addToast(t(PURCHASE_ERROR_KEY[result.error ?? ''] ?? 'cosmeticErrorGeneric'), 'error');
        return;
      }
      if (result.balance != null) coinsStore.setCoins(result.balance);
      haptic('success');
      playSound('coin_chime');
      addToast(t('cosmeticPurchaseSuccess'), 'success');
      await fetchProfile();
    } catch {
      addToast(t('cosmeticErrorGeneric'), 'error');
    } finally {
      setPendingItemId(null);
    }
  };

  const equip = async (item: CosmeticItem, unequip: boolean) => {
    if (pendingItemId) return;
    setPendingItemId(item.itemId);
    haptic('selection');
    playSound('toggle_click');
    try {
      const { data, error } = await supabase.rpc('equip_cosmetic', {
        p_slot: item.slot,
        p_item_id: unequip ? null : item.itemId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        addToast(t(EQUIP_ERROR_KEY[result.error ?? ''] ?? 'cosmeticErrorGeneric'), 'error');
        return;
      }
      haptic('success');
      playSound('lock_thud');
      addToast(t(unequip ? 'cosmeticUnequipSuccess' : 'cosmeticEquipSuccess'), 'success');
      await fetchProfile();
    } catch {
      addToast(t('cosmeticErrorGeneric'), 'error');
    } finally {
      setPendingItemId(null);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 && info.velocity.y > 20) onClose();
        }}
        dir={isHe ? 'rtl' : 'ltr'}
      >
        <div className="card-elevated border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
          </div>

          <div className="px-5 pt-3 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bebas text-2xl tracking-wider text-white">{t('prestigeShopTitle')}</h2>
                <p className="text-white/45 text-xs mt-0.5">
                  {t('prestigeShopSubtitle').replace('{0}', activeGroupName)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all text-sm shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="px-4 py-3 space-y-4 max-h-[65vh] overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {COSMETIC_SLOTS.map((slot) => (
              <div key={slot}>
                <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2 px-1">
                  {t(SLOT_LABEL_KEY[slot])}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {COSMETIC_CATALOG.filter((c) => c.slot === slot).map((item) => {
                    const isOwned = unlocked.has(item.itemId);
                    const isEquipped = active[slot] === item.itemId;
                    const isPending = pendingItemId === item.itemId;
                    return (
                      <div
                        key={item.itemId}
                        className={cn(
                          'rounded-xl border p-3 flex flex-col gap-2',
                          isEquipped ? 'border-accent-green/50 bg-accent-green/8' : 'border-white/8 bg-white/4',
                        )}
                      >
                        <div
                          className="w-full h-14 rounded-lg flex items-center justify-center"
                          style={{
                            background: item.colorSecondary
                              ? `linear-gradient(135deg, ${item.color}, ${item.colorSecondary})`
                              : `radial-gradient(circle, ${item.color}55, transparent 70%)`,
                            border: `1px solid ${item.color}55`,
                          }}
                        >
                          {!isOwned && <Lock size={16} className="text-white/70" />}
                          {isEquipped && <Check size={18} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate">
                            {isHe ? item.nameHe : item.nameEn}
                          </p>
                          {!isOwned && (
                            <p className="flex items-center gap-1 text-amber-400 text-[11px] font-bold mt-0.5">
                              <CoinIcon size={11} /> {item.cost}
                            </p>
                          )}
                        </div>
                        {isOwned ? (
                          <button
                            type="button"
                            onClick={() => equip(item, isEquipped)}
                            disabled={isPending}
                            className={cn(
                              'h-8 rounded-lg text-[11px] font-bold disabled:opacity-50 active:scale-95 transition-transform',
                              isEquipped
                                ? 'bg-white/8 border border-white/12 text-white/70'
                                : 'bg-accent-green text-bg-base',
                            )}
                          >
                            {isPending ? '···' : isEquipped ? t('cosmeticUnequip') : t('cosmeticEquip')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => purchase(item)}
                            disabled={isPending}
                            className="h-8 rounded-lg text-[11px] font-bold bg-white/8 border border-white/12 text-white/85 disabled:opacity-50 active:scale-95 transition-transform"
                          >
                            {isPending ? '···' : t('cosmeticBuy')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
