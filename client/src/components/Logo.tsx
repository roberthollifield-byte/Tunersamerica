export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-xl bg-gradient-to-br from-primary to-[#8df5ed] text-[#051416] shadow-lg ${className}`}
      aria-hidden="true"
    >
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 15L10 9L14 13L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 7H20V11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="link-logo">
      <LogoMark />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">TunersAmerica</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">Automotive tuner marketplace</div>
        )}
      </div>
    </div>
  );
}
