import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Database, ListTodo } from "lucide-react";

const TABS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/scrapers" },
  { icon: Database, label: "Sources", path: "/admin/scrapers/sources" },
  { icon: ListTodo, label: "Runs", path: "/admin/scrapers/runs" },
];

export default function ScrapersLayout() {
  const location = useLocation();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Scraper Framework</h1>
        <p className="text-sm text-muted-foreground">
          Manage scraper sources, browser configuration hooks, demo connector runs, and import integration.
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
