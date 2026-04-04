import { motion } from 'framer-motion';
import {
  checkPasswordRequirements,
  getPasswordStrength,
  type PasswordStrength as StrengthLevel,
} from '../../lib/authSchema';

// ─── Strength bar config ──────────────────────────────────────────────────────

const STRENGTH_META: Record<StrengthLevel, { bars: number; color: string; label: string; glow: string }> = {
  empty:        { bars: 0, color: 'bg-white/10',      label: '',            glow: 'none' },
  weak:         { bars: 1, color: 'bg-red-500',        label: 'Weak',        glow: '0 0 8px rgba(239,68,68,0.5)' },
  fair:         { bars: 2, color: 'bg-amber-400',      label: 'Fair',        glow: '0 0 8px rgba(251,191,36,0.5)' },
  strong:       { bars: 3, color: 'bg-lime-400',       label: 'Strong',      glow: '0 0 8px rgba(163,230,53,0.5)' },
  'very-strong':{ bars: 4, color: 'bg-accent-green',   label: 'Very strong', glow: '0 0 10px rgba(0,255,135,0.6)' },
};

// ─── Requirement rows ─────────────────────────────────────────────────────────

const REQUIREMENTS: { key: keyof ReturnType<typeof checkPasswordRequirements>; label: string }[] = [
  { key: 'minLength',    label: 'At least 8 characters'       },
  { key: 'hasUppercase', label: 'Uppercase letter (A–Z)'      },
  { key: 'hasLowercase', label: 'Lowercase letter (a–z)'      },
  { key: 'hasNumber',    label: 'Number (0–9)'                },
  { key: 'hasSpecial',   label: 'Special character (!@#…)'    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const reqs = checkPasswordRequirements(password);
  const meta = STRENGTH_META[strength];

  return (
    <div className="space-y-2.5">
      {/* ── Strength bars ── */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[0, 1, 2, 3].map(i => {
            const filled = i < meta.bars;
            return (
              <div key={i} className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${filled ? meta.color : 'bg-transparent'}`}
                  initial={{ scaleX: 0 }}
                  animate={{
                    scaleX: filled ? 1 : 0,
                    boxShadow: filled ? meta.glow : 'none',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.04 }}
                  style={{ originX: 0 }}
                />
              </div>
            );
          })}
        </div>
        <motion.span
          key={strength}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: strength === 'empty' ? 0 : 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`text-[11px] font-semibold w-[68px] text-right tabular-nums ${
            strength === 'weak'          ? 'text-red-400'    :
            strength === 'fair'          ? 'text-amber-400'  :
            strength === 'strong'        ? 'text-lime-400'   :
            strength === 'very-strong'   ? 'text-accent-green' :
            'text-transparent'
          }`}
        >
          {meta.label}
        </motion.span>
      </div>

      {/* ── Requirement checklist ── */}
      <div className="grid grid-cols-1 gap-0.5">
        {REQUIREMENTS.map(({ key, label }) => {
          const met = reqs[key];
          return (
            <motion.div
              key={key}
              className="flex items-center gap-2 py-0.5"
              initial={false}
            >
              {/* Tick / circle */}
              <div className="relative w-3.5 h-3.5 shrink-0">
                {/* Background circle */}
                <motion.div
                  className={`absolute inset-0 rounded-full border ${
                    met
                      ? 'border-accent-green bg-accent-green/20'
                      : 'border-white/20 bg-transparent'
                  }`}
                  animate={{ scale: met ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                />
                {/* Checkmark */}
                {met && (
                  <motion.svg
                    viewBox="0 0 10 10"
                    className="absolute inset-0 w-full h-full"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <motion.path
                      d="M 2 5 L 4.2 7.2 L 8 3"
                      stroke="rgba(0,255,135,1)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
                  </motion.svg>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[11px] transition-colors duration-200 ${
                  met ? 'text-accent-green' : 'text-white/35'
                }`}
              >
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
