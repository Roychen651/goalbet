interface CoinIconProps {
  size?: number;
  className?: string;
}

/**
 * Gold coin with star — flat design matching professional game/prediction apps.
 */
export function CoinIcon({ size = 18, className = '' }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer gold ring */}
      <circle cx="12" cy="12" r="12" fill="#F5C518" />
      {/* Inner darker disc */}
      <circle cx="12" cy="12" r="9" fill="#C9860A" />
      {/* 5-point star: outer R=6, inner r=2.5, center (12,12) */}
      <path
        d="M12 6 L13.47 9.98 L17.71 10.15 L14.38 12.77 L15.53 16.85 L12 14.5 L8.47 16.85 L9.62 12.77 L6.29 10.15 L10.53 9.98 Z"
        fill="#F5C518"
      />
    </svg>
  );
}
