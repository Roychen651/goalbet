import { useLangStore } from '../../stores/langStore';
import type { LeaderRow } from '../../hooks/useLeagueStats';

interface LeagueLeadersProps {
  scorers: LeaderRow[];
  assists: LeaderRow[];
}

export function LeagueLeaders({ scorers, assists }: LeagueLeadersProps) {
  const { t } = useLangStore();
  const hasScorers = scorers && scorers.length > 0;
  const hasAssists = assists && assists.length > 0;

  if (!hasScorers && !hasAssists) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {hasScorers && (
        <LeadersColumn
          title={t('statsTopScorers')}
          unit={t('statsGoals')}
          rows={scorers.slice(0, 10)}
        />
      )}
      {hasAssists && (
        <LeadersColumn
          title={t('statsTopAssists')}
          unit={t('statsAssists')}
          rows={assists.slice(0, 10)}
        />
      )}
    </div>
  );
}

function LeadersColumn({ title, unit, rows }: { title: string; unit: string; rows: LeaderRow[] }) {
  const { t } = useLangStore();

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card backdrop-blur-glass overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-border-subtle">
        <h3 className="font-barlow text-sm font-bold uppercase tracking-wider text-white">{title}</h3>
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{unit}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.athleteId || `${row.rank}-${row.name}`}
            className="flex items-center gap-3 px-4 py-2.5 border-t border-border-subtle/60 first:border-t-0"
          >
            <span className="w-5 text-end text-text-muted font-mono text-[11px] tabular-nums shrink-0">
              {row.rank}
            </span>
            {row.teamLogo ? (
              <img
                src={row.teamLogo}
                alt={row.teamName ?? ''}
                width={18}
                height={18}
                className="w-[18px] h-[18px] object-contain shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-[18px] h-[18px] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{row.name}</div>
              {row.matches !== null && (
                <div className="text-text-muted text-[10px] truncate">
                  {t('statsPlayerMatches').replace('{0}', String(row.matches))}
                </div>
              )}
            </div>
            <span className="font-mono text-sm tabular-nums text-white font-semibold shrink-0">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
