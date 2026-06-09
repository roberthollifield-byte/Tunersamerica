import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo, LogoMark } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useTheme } from "./theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu, Moon, Sun, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { href: "/tuners", label: "Find a Tuner" },
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/join", label: "For Tuners" },
  { href: "/pricing", label: "Pricing" },
];

function NavLinks({ onClick }: { onClick?: () => void }) {
  const [loc] = useLocation();
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={onClick}
          data-testid={`link-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
          className={`text-sm transition-colors hover:text-foreground ${
            loc === n.href ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {n.label}
        </Link>
      ))}
    </>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const dashHref = user?.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" data-testid="link-home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-account-menu" className="hidden sm:inline-flex">
                  <UserIcon className="mr-2 h-4 w-4" />
                  {user.name.split(" ")[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(dashHref)} data-testid="menu-dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" data-testid="button-signin" onClick={() => navigate("/signin")}>
              Sign in
            </Button>
          )}

          <Button className="hidden sm:inline-flex" size="sm" data-testid="button-find-tuner-nav" onClick={() => navigate("/tuners")}>
            Find a Tuner
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-2 flex flex-col gap-5">
                <Logo />
                <div className="flex flex-col gap-4">
                  <NavLinks onClick={() => setOpen(false)} />
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  {user ? (
                    <>
                      <Button variant="outline" onClick={() => { navigate(dashHref); setOpen(false); }} data-testid="button-mobile-dashboard">Dashboard</Button>
                      <Button variant="ghost" onClick={() => { logout(); navigate("/"); setOpen(false); }} data-testid="button-mobile-logout">Sign out</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => { navigate("/signin"); setOpen(false); }} data-testid="button-mobile-signin">Sign in</Button>
                  )}
                  <Button onClick={() => { navigate("/tuners"); setOpen(false); }} data-testid="button-mobile-find">Find a Tuner</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const cols = [
    { title: "Explore", links: [["Find a Tuner", "/tuners"], ["Services", "/services"], ["How It Works", "/how-it-works"]] },
    { title: "For Tuners", links: [["Join as a Tuner", "/join"], ["Pricing", "/pricing"], ["Sign in", "/signin"]] },
    { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
  ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="mb-4 flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <div className="font-display font-bold">TuneLink</div>
          </div>
          <p className="text-sm text-muted-foreground">
            A two-sided marketplace connecting car owners with verified automotive tuners for remote
            tuning, dyno sessions, diagnostics, and full build support.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 text-sm font-semibold">{c.title}</div>
            <div className="flex flex-col gap-2">
              {c.links.map(([label, href]) => (
                <Link key={label} href={href} className="text-sm text-muted-foreground hover:text-foreground" data-testid={`link-footer-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5">
        <div className="mx-auto w-full max-w-[1200px] px-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} TuneLink. All rights reserved. Demo marketplace — Stripe and email are stubbed.
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-[1200px] px-4 py-14 md:py-20 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="tl-eyebrow" data-testid="text-eyebrow">{children}</span>;
}
