interface EmptyStateProps {
  /** A string renders as a big illustrative glyph (the default, ⚽) — kept
   *  for every existing call site. Visual cleanup (live QA): widened to
   *  also accept a real lucide-react element, additively, so a call site
   *  that was passing a decorative emoji as UI chrome (e.g. a trophy on a
   *  "no bracket yet" state) can swap to a real icon without this
   *  component's many other, genuinely-illustrative call sites changing
   *  at all. */
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '⚽', title, description, action }: EmptyStateProps) {
  const isGlyph = typeof icon === 'string';
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className={isGlyph ? 'text-5xl mb-4 opacity-50' : 'mb-4 opacity-60 text-text-muted'}>{icon}</div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      {description && (
        <p className="text-text-muted text-sm max-w-xs mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
