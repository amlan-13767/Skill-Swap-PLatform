import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./lib/auth";
import Profile from "@/pages/profile";
import Requests from "@/pages/requests";
import Matches from "@/pages/matches";
import Browse from "@/pages/browse";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import { ProtectedRoute } from "@/components/AppShell";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/browse" component={Browse} />
      <Route path="/profile">{() => <ProtectedRoute><Profile /></ProtectedRoute>}</Route>
      <Route path="/requests">{() => <ProtectedRoute><Requests /></ProtectedRoute>}</Route>
      <Route path="/matches">{() => <ProtectedRoute><Matches /></ProtectedRoute>}</Route>
      <Route path="/settings">{() => <ProtectedRoute><Settings /></ProtectedRoute>}</Route>
      <Route path="/notifications">{() => <ProtectedRoute><Notifications /></ProtectedRoute>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
