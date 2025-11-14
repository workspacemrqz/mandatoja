import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivationProvider } from "@/contexts/activation-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ isAuthenticated: boolean }>({
    queryKey: ["/api/auth/check"],
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!data?.isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/eleitores">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/equipe">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/material">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/agentes">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/agendamentos">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/configuracoes">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/chat">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ActivationProvider>
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </ActivationProvider>
    </QueryClientProvider>
  );
}

export default App;
