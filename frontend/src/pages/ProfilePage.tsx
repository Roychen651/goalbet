import { TranslationKey } from '../lib/i18n';
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
import { formatKickoffTime, isMatchLocked, calcBreakdown } from '../lib/utils';
import { LIVE_STATUSES, FINISHED_STATUSES } from '../lib/constants';
import { InfoTip } from '../components/ui/InfoTip';

interface PredictionWithMatch extends Prediction {
  match: Match;
}

export function ProfilePage() {
  const { user, profile, signOut, updateUsername } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const [history, setHistory] = useState<PredictionWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

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
      await supabase.from('predictions').upsert({
        user_id: user.id,
        match_id: data.match_id,
        group_id: activeGroupId,
        predicted_outcome: data.predicted_outcome,
        predicted_home_score: data.predicted_home_score,
        predicted_away_score: data.predicted_away_score,
        predicted_corners: data.predicted_corners,
        predicted_btts: data.predicted_btts,
        predicted_over_under: data.predicted_over_under,
      }, { onConflict: 'user_id,match_id,group_id' });
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

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await updateUsername(nameInput.trim());
      setEditingName(false);
    } catch {
      // silent
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  if (!profile) return <PageLoader />;

  const resolved = history.filter(p => p.is_resolved);
  const totalPoints = resolved.reduce((sum, p) => sum + p.points_earned, 0);

  // Hit rate: only FT Result predictions (predicted_outcome must be set, match must be FT)
  const ftPredictions = resolved.filter(p => p.match.status === 'FT' && p.predicted_outcome !== null);
  const ftCorrect = ftPredictions.filter(p => {
    const actual = p.match.home_score! > p.match.away_score! ? 'H' : p.match.home_score! < p.match.away_score! ? 'A' : 'D';
    return (p.predicted_outcome as string) === actual;
  });

  const now = Date.now();
  const isPastKickoff = (p: PredictionWithMatch) => new Date(p.match.kickoff_time).getTime() < now;

  // Live = actual live statuses OR NS matches that have passed kickoff (backend hasn't polled yet)
  const livePreds = history.filter(p =>
    LIVE_STATUSES.includes(p.match.status) ||
    p.match.status === 'AET' ||
    (p.match.status === 'NS' && isPastKickoff(p))
  );
  // Upcoming = NS matches not yet kicked off
  const upcomingPreds = history.filter(p => p.match.status === 'NS' && !isPastKickoff(p));
  // History = finished/cancelled — sorted newest kickoff first so most recent results appear at top
  const historyPreds = history
    .filter(p => FINISHED_STATUSES.includes(p.match.status))
    .sort((a, b) => new Date(b.match.kickoff_time).getTime() - new Date(a.match.kickoff_time).getTime());

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>

      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 90, damping: 18 }}>
        <GlassCard variant="elevated" className="p-5">
          <div className="flex items-center gap-4">
            <motion.button onClick={() => setShowAvatarPicker(true)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} className="relative group shrink-0" title={t('chooseAvatar')}>
              <Avatar src={profile.avatar_url} name={profile.username} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">✏️</span>
              </div>
            </motion.button>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white/8 border border-white/15 text-white text-lg font-bebas tracking-wider focus:outline-none focus:border-accent-green/50"
                    maxLength={30}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <NeonButton variant="green" size="sm" loading={savingName} onClick={handleSaveName}>Save</NeonButton>
                  <button onClick={() => setEditingName(false)} className="text-text-muted hover:text-white text-xs px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-bebas text-2xl tracking-wider text-white truncate">{profile.username}</h1>
                  <button onClick={() => { setNameInput(profile.username); setEditingName(true); }} className="text-text-muted hover:text-white transition-colors text-sm" title="Edit display name">✏️</button>
                </div>
              )}
              {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
              <button onClick={() => setShowAvatarPicker(true)} className="text-accent-green text-xs mt-0.5 hover:underline">{t('chooseAvatar')}</button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Stats grid */}
      <motion.div className="grid grid-cols-3 gap-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
        {[
          {
            label: t('totalPoints'),
            value: totalPoints,
            highlight: true,
            sub: resolved.length > 0 ? `${t('avgLabel')} ${(totalPoints / resolved.length).toFixed(1)} ${t('perMatch')}` : t('allTimeLabel'),
            info: t('infoTotalPoints'),
          },
          {
            label: t('hitRate'),
            value: ftPredictions.length > 0 ? `${ftCorrect.length}/${ftPredictions.length}` : '—',
            sub: t('ftResultCorrect'),
            info: t('infoHitRate'),
          },
          {
            label: t('predictions'),
            value: `${history.length}`,
            sub: `${resolved.length} ${t('accurate')}`,
            info: t('infoPredictions'),
          },
        ].map(stat => (
          <motion.div key={stat.label} variants={{ hidden: { opacity: 0, y: 20, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 18 } } }} whileHover={{ scale: 1.04, y: -3 }} transition={{ type: 'spring', stiffness: 300 }}>
            <StatCard label={stat.label} value={stat.value} highlight={stat.highlight} sub={stat.sub} info={stat.info} />
          </motion.div>
        ))}
      </motion.div>

      {/* Prediction sections */}
      {loading ? (
        <PageLoader />
      ) : history.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">{t('noPredictions')}</p>
      ) : (
        <>
          {/* LIVE */}
          {livePreds.length > 0 && (
            <PredictionSection
              title={`🔴 ${t('liveNow')}`}
              predictions={livePreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
            />
          )}

          {/* UPCOMING */}
          {upcomingPreds.length > 0 && (
            <PredictionSection
              title={`⏳ ${t('upcoming')}`}
              predictions={upcomingPreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
            />
          )}

          {/* HISTORY */}
          {historyPreds.length > 0 && (
            <PredictionSection
              title={t('predictionHistory')}
              predictions={historyPreds}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deleting={deleting}
              saving={saving}
              onSave={handleSavePrediction}
              onDelete={handleDeletePrediction}
              t={t}
              paginated
            />
          )}
        </>
      )}

      <div className="pt-4">
        <NeonButton variant="danger" onClick={handleSignOut} loading={signingOut} className="w-full">{t('signOut')}</NeonButton>
      </div>

      <AnimatePresence>
        {showAvatarPicker && <AvatarPicker onClose={() => setShowAvatarPicker(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

const HISTORY_PAGE_SIZE = 5;

interface SectionProps {
  title: string;
  predictions: (Prediction & { match: Match })[];
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  deleting: string | null;
  saving: string | null;
  onSave: (data: PredictionData, id: string) => Promise<void>;
  onDelete: (id: string) => void;
  t: (key: TranslationKey) => string;
  paginated?: boolean;
}

function PredictionSection({ title, predictions, expandedIds, toggleExpanded, confirmDeleteId, setConfirmDeleteId, deleting, saving, onSave, onDelete, t, paginated }: SectionProps) {
  const [visibleCount, setVisibleCount] = useState(paginated ? HISTORY_PAGE_SIZE : predictions.length);
  // Reset pagination when the predictions list changes (e.g. group switch)
  useEffect(() => {
    if (paginated) setVisibleCount(HISTORY_PAGE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions.length]);
  const visible = predictions.slice(0, visibleCount);
  const hasMore = visibleCount < predictions.length;

  return (
    <div>
      <h2 className="font-bebas text-lg tracking-wider text-white mb-3">{title}</h2>
      <motion.div className="space-y-2" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
        {visible.map(pred => {
          const editable = pred.match.status === 'NS' && !isMatchLocked(pred.match.kickoff_time);
          const { lockCountdown } = formatKickoffTime(pred.match.kickoff_time);
          const isExpanded = expandedIds.has(pred.id);
          return (
            <motion.div key={pred.id} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 90, damping: 18 } } }}>
              <GlassCard className="overflow-hidden">
                <button
                  className="w-full p-3 flex items-center gap-3 text-start hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpanded(pred.id)}
                >
                  <div className="w-8 text-center shrink-0">
                    {pred.is_resolved ? (
                      pred.points_earned > 0 ? <span className="text-accent-green text-sm">✓</span> : <span className="text-text-muted text-sm">✗</span>
                    ) : editable ? (
                      <span className="text-blue-400 text-sm">✏️</span>
                    ) : (
                      <span className="text-yellow-400 text-sm">⏳</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{pred.match.home_team} vs {pred.match.away_team}</div>
                    <div className="text-text-muted text-xs flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{formatKickoffTime(pred.match.kickoff_time).date}</span>
                      <MatchStatusBadge status={
                        pred.match.went_to_penalties ? 'PEN'
                        : pred.match.regulation_home != null ? 'AET'
                        : pred.match.status
                      } />
                      {editable && lockCountdown && (
                        <span className="text-amber-400/80">🔒 {lockCountdown}</span>
                      )}
                      {editable && !lockCountdown && <span className="text-blue-400">· {t('editPrediction')}</span>}
                      {pred.match.regulation_home != null && (
                        <span className="text-amber-400/70">90′: {pred.match.regulation_home}–{pred.match.regulation_away}</span>
                      )}
                    </div>
                    {/* Prediction summary pills — always visible so user can verify without expanding */}
                    <PredictionSummaryPills prediction={pred} match={pred.match} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pred.is_resolved && (
                      <div className={`font-bebas text-lg ${pred.points_earned > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
                        {pred.points_earned > 0 ? `+${pred.points_earned}` : '0'}
                      </div>
                    )}
                    {editable && (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pred.id); }} className="text-text-muted hover:text-red-400 text-xs px-1.5 py-1 rounded-lg hover:bg-red-400/10 transition-all" title="Remove prediction">🗑</button>
                    )}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-white/20 text-xs">▾</motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {confirmDeleteId === pred.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                        <span className="text-white/70 text-xs">Remove this prediction?</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setConfirmDeleteId(null)} className="text-text-muted text-xs hover:text-white px-2 py-1 rounded">{t('cancel')}</button>
                          <button onClick={() => onDelete(pred.id)} disabled={deleting === pred.id} className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                            {deleting === pred.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} className="overflow-hidden">
                      <div className="px-3 pb-3 border-t border-white/5 pt-3">
                        {editable ? (
                          <PredictionForm match={pred.match} existingPrediction={pred} onSave={(data) => onSave(data, pred.id)} saving={saving === pred.id} />
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

      {/* Load more history */}
      {paginated && hasMore && (
        <button
          onClick={() => setVisibleCount(v => v + HISTORY_PAGE_SIZE)}
          className="mt-3 w-full py-2 text-sm text-text-muted hover:text-white border border-white/8 hover:border-white/20 rounded-xl bg-white/3 hover:bg-white/6 transition-all"
        >
          Show {Math.min(HISTORY_PAGE_SIZE, predictions.length - visibleCount)} more · {predictions.length - visibleCount} remaining
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight, sub, info }: { label: string; value: string | number; highlight?: boolean; sub?: string; info?: string }) {
  return (
    <GlassCard className="p-4 text-center">
      <div className="flex items-center justify-center text-text-muted text-xs uppercase tracking-wider mb-1 gap-0.5">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className={`font-bebas text-2xl tracking-wider ${highlight ? 'text-accent-green text-glow-green' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-white/20 text-[10px] mt-0.5 leading-tight">{sub}</div>}
    </GlassCard>
  );
}

/** Compact inline summary of what a user predicted — shown always in the card header row */
function PredictionSummaryPills({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const pills: { label: string; value: string }[] = [];

  const teamName = (outcome: 'H' | 'D' | 'A' | null) =>
    outcome === 'H' ? (match.home_team.split(' ').slice(-1)[0] ?? t('home'))
    : outcome === 'A' ? (match.away_team.split(' ').slice(-1)[0] ?? t('away'))
    : outcome === 'D' ? t('draw') : '';

  if (prediction.predicted_outcome) {
    pills.push({ label: t('result'), value: teamName(prediction.predicted_outcome) });
  }
  if (prediction.predicted_home_score !== null && prediction.predicted_away_score !== null) {
    pills.push({ label: t('score'), value: `${prediction.predicted_home_score}–${prediction.predicted_away_score}` });
  }
  if (prediction.predicted_corners) {
    const cl = prediction.predicted_corners === 'under9' ? t('cornersUnder9') : prediction.predicted_corners === 'ten' ? t('cornersTen') : t('cornersOver11');
    pills.push({ label: t('corners'), value: cl });
  }
  if (prediction.predicted_btts !== null) {
    pills.push({ label: t('btts'), value: prediction.predicted_btts ? t('yes') : t('no') });
  }
  if (prediction.predicted_over_under) {
    pills.push({ label: t('goals'), value: prediction.predicted_over_under === 'over' ? t('over25') : t('under25') });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {pills.map(p => (
        <span key={p.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/6 border border-white/10 text-[10px]">
          <span className="text-white/35">{p.label}</span>
          <span className="text-white/75 font-medium">{p.value}</span>
        </span>
      ))}
    </div>
  );
}

function ResolvedBreakdown({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const breakdown = calcBreakdown(prediction, match);

  const teamLabel = (outcome: 'H' | 'D' | 'A' | null) =>
    outcome === 'H' ? (match.home_team.split(' ').pop() ?? t('home'))
    : outcome === 'A' ? (match.away_team.split(' ').pop() ?? t('away'))
    : outcome === 'D' ? t('draw') : null;

  const cornersLabel = (v: 'under9' | 'ten' | 'over11' | null) =>
    v === 'under9' ? t('cornersUnder9') : v === 'ten' ? t('cornersTen') : v === 'over11' ? t('cornersOver11') : null;

  const tierDetail = (key: string): string | null => {
    switch (key) {
      case 'result': return prediction.predicted_outcome ? teamLabel(prediction.predicted_outcome) : null;
      case 'score': return prediction.predicted_home_score !== null
        ? `${prediction.predicted_home_score}–${prediction.predicted_away_score}` : null;
      case 'ht': return prediction.predicted_halftime_outcome ? teamLabel(prediction.predicted_halftime_outcome) : null;
      case 'corners': return cornersLabel(prediction.predicted_corners ?? null);
      case 'btts': return prediction.predicted_btts !== null ? (prediction.predicted_btts ? t('yes') : t('no')) : null;
      case 'ou': return prediction.predicted_over_under
        ? (prediction.predicted_over_under === 'over' ? t('over25') : t('under25')) : null;
      default: return null;
    }
  };

  if (!breakdown) {
    return (
      <div className="grid grid-cols-2 gap-1.5 text-sm">
        {prediction.predicted_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('result')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{teamLabel(prediction.predicted_outcome)}</span>
          </div>
        )}
        {prediction.predicted_home_score !== null && prediction.predicted_away_score !== null && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('score')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{prediction.predicted_home_score}–{prediction.predicted_away_score}</span>
          </div>
        )}
        {prediction.predicted_halftime_outcome && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">Half Time</span>
            <span className="text-white text-sm font-semibold mt-0.5">{teamLabel(prediction.predicted_halftime_outcome)}</span>
          </div>
        )}
        {prediction.predicted_corners && (
          <div className="flex flex-col items-center py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-white/40 text-xs">{t('corners')}</span>
            <span className="text-white text-sm font-semibold mt-0.5">{cornersLabel(prediction.predicted_corners)}</span>
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
      {breakdown.map(tier => {
        const detail = tierDetail(tier.key);
        const isPending = tier.pending === true;
        return (
          <div key={tier.key} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${tier.earned ? 'bg-accent-green/8 border border-accent-green/15' : isPending ? 'bg-blue-500/6 border border-blue-500/15' : 'bg-white/3 border border-white/5'}`}>
            <span className={`flex items-center gap-1.5 min-w-0 ${tier.earned ? 'text-accent-green' : isPending ? 'text-blue-400 opacity-70' : 'text-white/35'}`}>
              <span className="shrink-0">{tier.earned ? '✓' : isPending ? '…' : '✗'}</span>
              <span className="shrink-0">{tier.label}</span>
              {detail && (
                <span className={`truncate font-semibold ${tier.earned ? 'text-accent-green' : 'text-white/40'}`}>· {detail}</span>
              )}
            </span>
            <span className={`shrink-0 ${tier.earned ? 'text-accent-green font-semibold' : isPending ? 'text-blue-400/50' : 'text-white/20'}`}>
              {tier.earned ? `+${tier.pts}` : isPending ? '?' : '0'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
