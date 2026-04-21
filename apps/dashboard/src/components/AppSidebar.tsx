import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  FlaskConical,
  Smartphone,
  Users,
  BarChart3,
  Settings,
  ScrollText,
  ChevronLeft,
  Zap,
  LogOut,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { to: "/templates", icon: MessageSquareText, label: "Message Studio" },
  { to: "/experiments", icon: FlaskConical, label: "A/B Testing" },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/accounts", icon: Smartphone, label: "Accounts" },
  { to: "/contacts", icon: Users, label: "Contacts" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/logs", icon: ScrollText, label: "Activity Log" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground tracking-tight">
            WA Automation
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User + Sign Out */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && user && (
          <p className="text-[11px] text-muted-foreground truncate px-1">
            {user.email}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors w-full",
            "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </aside>
  );
}

