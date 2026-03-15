import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { supabase, Prediction, Match } from '../lib/supabase';
import { Avatar } from '../components/ui/Avatar';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { MatchStatusBadge } from '../components/matches/MatchStatusBadge';
import { PredictionForm, PredictionData } from '../components/matches/PredictionForm';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { formatKickoffTime, formatAccuracy, isMatchLocked, calcBreakdown } from '../lib/utils';

interface PredictionWithMatch extends Prediction {
  match: Match;
}

export function ProfilePage() {
  const { user, profile, signOut } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const [history, setHistory] = useState<PredictionWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const fetchHistory = () => {
    if (!user || !activeGroupId) return;
    supabase
      .from('predictions')
      .select('*, match:matches(*)')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory((data as PredictionWithMatch[]) || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, activeGroupId]);

  const handleSavePrediction = async (data: PredictionData, predictionId: string) => {
    if (!user || !activeGroupId) return;
    setSaving(predictionId);
    try {
      await supabase
        .from('predictions')
        .upsert({
          user_id: user.id,
          match_id: data.match_id,
          group_id: activeGroupId,
          predicted_outcome: data.predicted_outcome,
          predicted_home_score: data.predicted_home_score,
          predicted_away_score: data.predicted_away_score,
          predicted_halftime_outcome: data.predicted_halftime_outcome,
          predicted_btts: data.predicted_btts,
          predicted_over_under: data.predicted_over_under,
        }, { onConflict: 'user_id,match_id,group_id' });
      setExpandedId(null);
      fetchHistory();
    } finally {
      setSaving(null);
    }
  };

  const handleDeletePrediction = async (predictionId: string) => {
    setDeleting(predictionId);
    try {
      await supabase.from('predictions').delete().eq('id', predictionId);
      setConfirmDeleteId(null);
      fetchHistory();
    } finally {
      setDeleting(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  if (!profile) return <PageLoader />;

  const resolved = history.filter(p => p.is_resolved);
  const correct = resolved.filter(p => p.points_earned > 0);
  const totalPoints = resolved.reduce((sum, p) => sum + p.points_earned, 0);

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
      >
        <GlassCard variant="elevated" className="p-5">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => setShowAvatarPicker(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="relative group shrink-0"
              title={t('chooseAvatar')}
            >
              <Avatar src={profile.avatar_url} name={profile.username} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">✏️</span>
              </div>
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bebas text-2xl tracking-wider text-white truncate">{profile.username}</h1>
              {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
              <button
                onClick={() => setShowAvatarPicker(true)}
                className="text-accent-green text-xs mt-0.5 hover:underline"
              >
                {t('chooseAvatar')}
              </button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
      >
        {[
          { label: t('totalPoints'), value: totalPoints, highlight: true, sub: 'all time' },
          { label: t('predictions'), value: history.length, sub: 'placed' },
          { label: t('accuracy'), value: formatAccuracy(correct.length, resolved.length), sub: 'pts earned / resolved' },
          { label: t('correct'), value: `${correct.length}/${resolved.length}`, sub: 'scored any points' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            variants={{
              hidden: { opacity: 0, y: 20, scale: 0.95 },
              show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 18 } },
            }}
            whileHover={{ scale: 1.04, y: -3 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <StatCard label={stat.label} value={stat.value} highlight={stat.highlight} sub={stat.sub} />
          </motion.div>
        ))}
      </motion.div>

      {/* Prediction history */}
      <div>
        <h2 className="font-bebas text-lg tracking-wider text-white mb-3">{t('predictionHistory')}</h2>
        {loading ? (
          <PageLoader />
        ) : history.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">{t('noPredictions')}</p>
        ) : (
          <motion.div
            className="space-y-2"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            {history.map(pred => {
              const editable = pred.match.status === 'NS' && !isMatchLocked(pred.match.kickoff_time);
              const isExpanded = expandedId === pred.id;
              return (
                <motion.div
                  key={pred.id}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 90, damping: 18 } },
                  }}
                >
                  <GlassCard className="overflow-hidden">
                    <button
                      className="w-full p-3 flex items-center gap-3 text-start hover:bg-white/3 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                    >
                      <div className="w-8 text-center shrink-0">
                        {pred.is_resolved ? (
                          pred.points_earned > 0
                            ? <span className="text-accent-green text-sm">✓</span>
                            : <span className="text-text-muted text-sm">✗</span>
                        ) : editable ? (
                          <span className="text-blue-400 text-sm">✏️</span>
                        ) : (
                          <span className="text-yellow-400 text-sm">⏳</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {pred.match.home_team} vs {pred.match.away_team}
                        </div>
                        <div className="text-text-muted text-xs flex items-center gap-2 mt-0.5">
                          <span>{formatKickoffTime(pred.match.kickoff_time).date}</span>
                          <MatchStatusBadge status={pred.match.status} />
                          {editable && (
                            <span className="text-blue-400">· {t('editPrediction')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pred.is_resolved && (
                          <div className={`font-bebas text-lg ${pred.points_earned > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
                            {pred.points_earned > 0 ? `+${pred.points_earned}` : '0'}
                          </div>
                        )}
                        {editable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pred.id); setExpandedId(null); }}
                            className="text-text-muted hover:text-red-400 text-xs px-1.5 py-1 rounded-lg hover:bg-red-400/10 transition-all"
                            title="Remove prediction"
                          >
                            🗑
                          </button>
                        )}
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-white/20 text-xs"
                        >▾</motion.div>
                      </div>
                    </button>

                    {/* Delete confirm */}
                    <AnimatePresence>
                      {confirmDeleteId === pred.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                            <span className="text-white/70 text-xs">Remove this prediction?</span>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-text-muted text-xs hover:text-white px-2 py-1 rounded"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                onClick={() => handleDeletePrediction(pred.id)}
                                disabled={deleting === pred.id}
                                className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                              >
                                {deleting === pred.id ? '...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 border-t border-white/5 pt-3">
                            {editable ? (
                              <PredictionForm
                                match={pred.match}
                                existingPrediction={pred}
                                onSave={(data) => handleSavePrediction(data, pred.id)}
                                saving={saving === pred.id}
                              />
                            ) : (
                              <ResolvedBreakdown prediction={pred} match={pred.match} />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <div className="pt-4">
        <NeonButton variant="danger" onClick={handleSignOut} loading={signingOut} className="w-full">
          {t('signOut')}
        </NeonButton>
      </div>

      <AnimatePresence>
        {showAvatarPicker && <AvatarPicker onClose={() => setShowAvatarPicker(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, highlight, sub }: { label: string; value: string | number; highlight?: boolean; sub?: string }) {
  return (
    <GlassCard className="p-4 text-center">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-bebas text-2xl tracking-wider ${highlight ? 'text-accent-green text-glow-green' : 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-white/20 text-[10px] mt-0.5 leading-tight">{sub}</div>}
    </GlassCard>
  );
}

function ResolvedBreakdown({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const breakdown = calcBreakdown(prediction, match);
  const outcomeLabel = (v: 'H' | 'D' | 'A' | null) =>
    v === 'H' ? t('home') : v === 'A' ? t('away') : v === 'D' ? t('draw') : '—';

  if (!breakdown) {
    // Not yet resolved — show all predicted tiers
    return (
      <div className="grid grid-cols-2 gap-1.5 text-sm">
        {prediction.predicted_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('result')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{outcomeLabel(prediction.predicted_outcome)}</span>
          </div>
        )}
        {prediction.predicted_home_score !== null && prediction.predicted_away_score !== null && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('score')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_home_score} — {prediction.predicted_away_score}</span>
          </div>
        )}
        {prediction.predicted_halftime_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('halfTimeResult')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{outcomeLabel(prediction.predicted_halftime_outcome)}</span>
          </div>
        )}
        {prediction.predicted_btts !== null && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('btts')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_btts ? t('yes') : t('no')}</span>
          </div>
        )}
        {prediction.predicted_over_under && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('goals')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_over_under === 'over' ? t('over25') : t('under25')}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {breakdown.map(tier => (
        <div
          key={tier.key}
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
            tier.earned ? 'bg-accent-green/8 border border-accent-green/15' : 'bg-white/3 border border-white/5'
          }`}
        >
          <span className={`flex items-center gap-1.5 ${tier.earned ? 'text-accent-green' : 'text-white/35'}`}>
            <span>{tier.earned ? '✓' : '✗'}</span>
            <span>{tier.label}</span>
          </span>
          <span className={tier.earned ? 'text-accent-green font-semibold' : 'text-white/20'}>
            {tier.earned ? `+${tier.pts}` : '0'}
          </span>
        </div>
      ))}
    </div>
  );
}
