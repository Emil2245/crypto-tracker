interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 100 100"
      aria-hidden
      className={className}
    >
      <path
        d="M50 16 L84 50 L50 84 L16 50 Z"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M50 16 L84 50 L50 84 Z" fill="white" />
    </svg>
  );
}
