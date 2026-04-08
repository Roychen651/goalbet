import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Trophy, Target, Gift, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useLangStore } from '../../stores/langStore';
import { CoinIcon } from './CoinIcon';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoinTransaction {
  id: string;
  type: 'join_bonus' | 'daily_bonus' | 'bet_placed' | 'bet_won';
  amount: number;
  balance_after: number;
  description: string | null;
  match_id: string | null;
  created_at: string;
  matches?: { home_team: string; away_team: string } | null;
}

// ─── Type config ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<CoinTransaction['type'], {
  Icon: typeof Sun;
  labelKey: TranslationKey;
  iconBg: string;
  iconColor: string;
}> = {
  daily_bonus: {
    Icon: Sun,
    labelKey: 'dailyBonusRow',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  bet_won: {
    Icon: Trophy,
    labelKey: 'matchRewardRow',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  bet_placed: {
    Icon: Target,
    labelKey: 'betPlacedRow',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
  },
  join_bonus: {
    Icon: Gift,
    labelKey: 'joinBonusRow',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400',
  },
};

// ─── Relative time ───────────────────────────────────────────────────────────

function relativeTime(createdAt: string, t: (key: TranslationKey) => string): string {
  const diffMs  = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1)  return t('notifJustNow');
  if (diffMin < 60) return `${diffMin} ${t('notifMinAgo')}`;
  if (diffHr  < 24) return `${diffHr} ${t('notifHrAgo')}`;
  return `${diffDay} ${t('notifDayAgo')}`;
}

// ─── Transaction row ─────────────────────────────────────────────────────────

function TxRow({ tx, t }: { tx: CoinTransaction; t: (key: TranslationKey) => string }) {
  const config = TYPE_CONFIG[tx.type] ?? {
    Icon: Wrench,
    labelKey: 'adminAdjustRow' as TranslationKey,
    iconBg: 'bg-white/10',
    iconColor: 'text-text-muted',
  };
  const { Icon, labelKey, iconBg, iconColor } = config;
  const isPositive = tx.amount > 0;

  // For match-related transactions, show team names if available
  const matchLabel = tx.matches
    ? `${tx.matches.home_team} vs ${tx.matches.away_team}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--card-border)] last:border-0"
    >
      {/* Icon */}
      <div className={cn('shrink-0 w-9 h-9 rounded-full flex items-center justify-center', iconBg)}>
        <Icon size={16} className={iconColor} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {matchLabel ?? t(labelKey)}
        </p>
        <p className="text-[11px] text-text-muted opacity-60 mt-0.5">
          {relativeTime(tx.created_at, t)}
        </p>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-end">
        <span className={cn(
          'text-sm font-bold tabular-nums',
          isPositive ? 'text-emerald-400' : 'text-text-muted',
        )}>
          {isPositive ? '+' : ''}{tx.amount}
        </span>
        <p className="text-[10px] text-text-muted opacity-50 mt-0.5 tabular-nums">
          {tx.balance_after}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyLedger({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center justify-center py-12 px-6 gap-3"
    >
      <CoinIcon size={40} />
      <p className="text-text-primary text-sm font-medium text-center opacity-70">
        {t('emptyLedger')}
      </p>
      <p className="text-text-muted text-xs text-center opacity-60">
        {t('emptyLedgerDesc')}
      </p>
    </motion.div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

interface CoinHistoryModalProps {
  onClose: () => void;
}

export function CoinHistoryModal({ onClose }: CoinHistoryModalProps) {
  const { t } = useLangStore();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const coins = useCoinsStore(s => s.coins);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !activeGroupId) return;

    supabase
      .from('coin_transactions')
      .select('id, type, amount, balance_after, description, match_id, created_at, matches(home_team, away_team)')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setTransactions((data as CoinTransaction[] | null) ?? []);
        setLoading(false);
      });
  }, [user?.id, activeGroupId]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Compute summary
  const totalStaked = transactions
    .filter(tx => tx.type === 'bet_placed')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalEarned = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.75 }}
        className={cn(
          'relative z-10 w-full sm:max-w-[400px] overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl',
          'shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
          'max-h-[85vh] sm:max-h-[70vh] flex flex-col',
        )}
        style={{
          background: 'var(--color-tooltip-bg)',
          border: '1px solid var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <CoinIcon size={20} />
              <span className="text-sm font-bold text-text-primary">{t('coinHistory')}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/8 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Balance + summary row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <p className="text-[10px] text-amber-500/60 uppercase tracking-widest font-semibold">{t('coinHistoryBalance')}</p>
              <p className="text-amber-400 font-bold text-lg tabular-nums leading-tight">{coins}</p>
            </div>
            <div className="flex-1 rounded-xl bg-white/5 border border-[var(--card-border)] px-3 py-2">
              <p className="text-[10px] text-text-muted opacity-60 uppercase tracking-widest font-semibold">{t('coinHistoryStaked')}</p>
              <p className="text-text-primary font-bold text-lg tabular-nums leading-tight">{totalStaked}</p>
            </div>
            <div className="flex-1 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
              <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest font-semibold">{t('coinHistoryEarned')}</p>
              <p className="text-emerald-400 font-bold text-lg tabular-nums leading-tight">{totalEarned}</p>
            </div>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--card-border)] border-t-amber-400 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <EmptyLedger t={t} />
          ) : (
            <motion.div layout>
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <TxRow tx={tx} t={t} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
