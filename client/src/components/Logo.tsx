import wordmark from "@/assets/brand/wordmark.png";
import icon from "@/assets/brand/icon.png";

// Square brand mark (TunersAmerica monogram). Use anywhere we'd previously
// shown the gradient tile — site header on mobile, footer, favicon source, etc.
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src={icon}
      alt="TunersAmerica"
      className={`${className} object-contain`}
      data-testid="logo-mark"
    />
  );
}

// Full horizontal wordmark. `subtitle` is kept in the API surface for backward
// compat but is ignored — the wordmark itself is the brand statement now.
export function Logo(_props: { subtitle?: boolean } = {}) {
  return (
    <div className="flex items-center" data-testid="link-logo">
      <img
        src={wordmark}
        alt="TunersAmerica"
        className="h-8 w-auto select-none sm:h-9"
        draggable={false}
      />
    </div>
  );
}
