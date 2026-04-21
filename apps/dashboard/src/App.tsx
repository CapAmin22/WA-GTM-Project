import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

// Pages
import LoginPage from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CampaignsPage from "./pages/Campaigns";
import NewCampaignPage from "./pages/NewCampaign";
import CampaignDetailPage from "./pages/CampaignDetail";
import TemplatesPage from "./pages/Templates";
import TemplateEditorPage from "./pages/TemplateEditor";
import ExperimentsPage from "./pages/Experiments";
import AccountsPage from "./pages/Accounts";
import ContactsPage from "./pages/Contacts";
import AnalyticsPage from "./pages/Analytics";
import SettingsPage from "./pages/Settings";
import LogsPage from "./pages/Logs";
import InboxPage from "./pages/Inbox";

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />

            {/* Protected */}
            <Route path="/" element={<PrivateRoute><Index /></PrivateRoute>} />
            <Route path="/campaigns" element={<PrivateRoute><CampaignsPage /></PrivateRoute>} />
            <Route path="/campaigns/new" element={<PrivateRoute><NewCampaignPage /></PrivateRoute>} />
            <Route path="/campaigns/:id" element={<PrivateRoute><CampaignDetailPage /></PrivateRoute>} />
            <Route path="/templates" element={<PrivateRoute><TemplatesPage /></PrivateRoute>} />
            <Route path="/templates/new" element={<PrivateRoute><TemplateEditorPage /></PrivateRoute>} />
            <Route path="/templates/:id/edit" element={<PrivateRoute><TemplateEditorPage /></PrivateRoute>} />
            <Route path="/experiments" element={<PrivateRoute><ExperimentsPage /></PrivateRoute>} />
            <Route path="/experiments/new" element={<PrivateRoute><ExperimentsPage /></PrivateRoute>} />
            <Route path="/experiments/:id" element={<PrivateRoute><ExperimentsPage /></PrivateRoute>} />
            <Route path="/accounts" element={<PrivateRoute><AccountsPage /></PrivateRoute>} />
            <Route path="/contacts" element={<PrivateRoute><ContactsPage /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><LogsPage /></PrivateRoute>} />
            <Route path="/inbox" element={<PrivateRoute><InboxPage /></PrivateRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
