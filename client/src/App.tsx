import { Switch, Route, Router } from "wouter";
import { useHashLocation as useHashLocationOriginal } from "wouter/use-hash-location";
import { useCallback } from "react";

// Wrap wouter's hash location hook so query strings (e.g. magic-link tokens)
// in the hash don't break route matching. Without this, '#/auth/callback?token=...'
// fails to match the '/auth/callback' route and falls through to NotFound.
function useHashLocation(): [string, (path: string, opts?: any) => void] {
  const [loc, navigate] = useHashLocationOriginal();
  const cleanLoc = loc.split("?")[0] || "/";
  const wrappedNavigate = useCallback(
    (path: string, opts?: any) => navigate(path, opts),
    [navigate],
  );
  return [cleanLoc, wrappedNavigate];
}
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Tuners from "@/pages/Tuners";
import TunerProfile from "@/pages/TunerProfile";
import Services from "@/pages/Services";
import HowItWorks from "@/pages/HowItWorks";
import Join from "@/pages/Join";
import Pricing from "@/pages/Pricing";
import SignIn from "@/pages/SignIn";
import AuthCallback from "@/pages/AuthCallback";
import Book from "@/pages/Book";
import CustomerDashboard from "@/pages/CustomerDashboard";
import TunerDashboard from "@/pages/TunerDashboard";
import { About, Privacy, Terms, Contact } from "@/pages/Static";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tuners" component={Tuners} />
      <Route path="/tuners/:id" component={TunerProfile} />
      <Route path="/services" component={Services} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/join" component={Join} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/signin" component={SignIn} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/book/:id" component={Book} />
      <Route path="/dashboard/customer" component={CustomerDashboard} />
      <Route path="/dashboard/tuner" component={TunerDashboard} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
