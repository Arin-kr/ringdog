export function Logo({ className = "h-8 w-8" }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
      <path d="M11 18v3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M20.5 24.5c-3.4-2-5.2-4.1-5.2-6.4a3 3 0 0 1 5.2-2 3 3 0 0 1 5.2 2c0 2.3-1.8 4.4-5.2 6.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
