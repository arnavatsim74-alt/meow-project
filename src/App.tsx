import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Dispatch from "./pages/Dispatch";
import SimBriefDispatch from "./pages/SimBriefDispatch";
import OFPViewer from "./pages/OFPViewer";
import MyFlightPlans from "./pages/MyFlightPlans";

import SubmitPirep from "./pages/SubmitPirep";
import MyPireps from "./pages/MyPireps";
import Fleet from "./pages/Fleet";
import Shop from "./pages/Shop";
import Leaderboard from "./pages/Leaderboard";
import Logbook from "./pages/Logbook";
import AdminPanel from "./pages/admin/AdminPanel";
import PendingApproval from "./pages/PendingApproval";
import Notams from "./pages/Notams";
import AeronauticalCharts from "./pages/AeronauticalCharts";
import NotFound from "./pages/NotFound";
import SimBriefCallback from "./pages/SimBriefCallback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/simbrief" element={<SimBriefDispatch />} />
            <Route path="/ofp" element={<OFPViewer />} />
            <Route path="/my-flight-plans" element={<MyFlightPlans />} />
            
            <Route path="/pirep" element={<SubmitPirep />} />
            <Route path="/my-pireps" element={<MyPireps />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/leaderboards" element={<Leaderboard />} />
            <Route path="/logbook" element={<Logbook />} />
            <Route path="/notams" element={<Notams />} />
            <Route path="/charts" element={<AeronauticalCharts />} />
            <Route path="/type-ratings" element={<Dashboard />} />
            <Route path="/simbrief/callback" element={<SimBriefCallback />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/*" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;