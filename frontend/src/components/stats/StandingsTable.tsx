import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';
import type { StandingsRow } from '../../hooks/useLeagueStats';

interface StandingsTableProps {
  rows: StandingsRow[];
}

export function StandingsTable({ rows }: StandingsTableProps) {
  const { t } = useLangStore();

  if (rows.length === 0) return null;

  return (
    // Wrapper is the horizontal scroller. The first column inside the table
    // is sticky to the inline-start edge so Rank + Team stay visible on mobile.
    // Sticky cells need a solid background so scrolling content doesn't bleed through.
    <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-card backdrop-blur-glass">
      <table className="w-full text-start text-[11px] font-mono border-separate border-spacing-0">
        <thead>
          <tr className="text-text-muted uppercase tracking-wider text-[10px]">
            <th className="sticky start-0 z-10 bg-bg-card px-3 py-2.5 text-start whitespace-nowrap font-semibold">
              {t('statsColRank')} · {t('statsColTeam')}
            </th>
            <Th>{t('statsColPlayed')}</Th>
            <Th>{t('statsColWon')}</Th>
            <Th>{t('statsColDrawn')}</Th>
            <Th>{t('statsColLost')}</Th>
            <Th>{t('statsColGF')}</Th>
            <Th>{t('statsColGA')}</Th>
            <Th>{t('statsColGD')}</Th>
            <Th bold>{t('statsColPts')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team.id || `${row.rank}-${row.team.name}`}>
              <td className="sticky start-0 z-10 bg-bg-card px-3 py-2.5 text-start whitespace-nowrap border-t border-border-subtle/60">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="w-5 text-end text-text-muted tabular-nums">{row.rank || '—'}</span>
                  {row.team.logo ? (
                    <img
                      src={row.team.logo}
                      alt={row.team.name}
                      width={18}
                      height={18}
                      className="w-[18px] h-[18px] object-contain shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className="w-[18px] h-[18px] shrink-0" />
                  )}
                  <span className="text-white text-xs font-sans font-medium truncate">
                    {row.team.shortName || row.team.name}
                  </span>
                </div>
              </td>
              <Td>{row.gp}</Td>
              <Td>{row.w}</Td>
              <Td>{row.d}</Td>
              <Td>{row.l}</Td>
              <Td>{row.gf}</Td>
              <Td>{row.ga}</Td>
              <Td>{formatSigned(row.gd)}</Td>
              <Td bold>{row.points}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function Th({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <th
      className={cn(
        'px-2 py-2.5 text-end whitespace-nowrap font-semibold',
        bold && 'text-white',
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td
      className={cn(
        'px-2 py-2.5 text-end whitespace-nowrap tabular-nums border-t border-border-subtle/60',
        bold ? 'text-white font-semibold' : 'text-white/80',
      )}
    >
      {children}
    </td>
  );
}
