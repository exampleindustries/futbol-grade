import { Switch, Route, Router } from "wouter";

import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Coaches from "@/pages/coaches";
import CoachDetail from "@/pages/coach-detail";
import WriteReview from "@/pages/write-review";
import Clubs from "@/pages/clubs";
import ClubDetail from "@/pages/club-detail";
import Marketplace from "@/pages/marketplace";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import ClaimCoach from "@/pages/claim-coach";
import SelectCoach from "@/pages/select-coach";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/coaches" component={Coaches} />
      <Route path="/coaches/:id" component={CoachDetail} />
      <Route path="/coaches/:id/review" component={WriteReview} />
      <Route path="/coaches/:id/claim" component={ClaimCoach} />
      <Route path="/review" component={SelectCoach} />
      <Route path="/clubs" component={Clubs} />
      <Route path="/clubs/:id" component={ClubDetail} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />
      <Route path="/auth/forgot-password" component={ForgotPassword} />
      <Route path="/auth/reset-password" component={ResetPassword} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
