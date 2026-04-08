import { AppLayout } from "@/components/AppLayout";
import { KPICards } from "@/components/dashboard/KPICards";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { QuickActions } from "@/components/dashboard/QuickActions";

const Index = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time overview of your messaging operations
            </p>
          </div>
          <QuickActions />
        </div>
        <KPICards />
        <DashboardCharts />
        <LiveActivityFeed />
      </div>
    </AppLayout>
  );
};

export default Index;
