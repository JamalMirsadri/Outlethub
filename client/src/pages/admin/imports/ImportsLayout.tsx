import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ListTodo, SlidersHorizontal, ScrollText, Activity } from "lucide-react";

const TABS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/imports" },
  { icon: Activity, label: "Observability", path: "/admin/import-observability" },
  { icon: ListTodo, label: "Jobs", path: "/admin/imports/jobs" },
  { icon: SlidersHorizontal, label: "Rules", path: "/admin/imports/rules" },
  { icon: ScrollText, label: "Logs", path: "/admin/imports/logs" },
];

export default function ImportsLayout() {
  const location = useLocation();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Import Engine</h1>
        <p className="text-sm text-muted-foreground">
          Manage sources, uploads, job processing, deal rules, and import logs.
        </p>
      </div>
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
        {TABS.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                active
                  ? "border-[hsl(var(--accent))] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
