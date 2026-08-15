import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Tag, Layers3, Link2, DollarSign, BarChart3, Activity, Bell, ChevronLeft, Menu, Sun, Moon, Globe, Truck, ClipboardList, CreditCard, Landmark, Users, FilePenLine, Award, TicketPercent, GitBranch, Megaphone } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Package, label: "Products", path: "/admin/products" },
  { icon: ShoppingCart, label: "Orders", path: "/admin/orders" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: CreditCard, label: "Payments", path: "/admin/payments" },
  { icon: CreditCard, label: "Pay Review", path: "/admin/payments/review" },
  { icon: Landmark, label: "Bank Accts", path: "/admin/bank-accounts" },
  { icon: DollarSign, label: "FX Rates", path: "/admin/exchange-rates" },
  { icon: ClipboardList, label: "Procurement", path: "/admin/procurement" },
  { icon: Tag, label: "Brands", path: "/admin/brands" },
  { icon: Layers3, label: "Categories", path: "/admin/categories" },
  { icon: DollarSign, label: "Pricing", path: "/admin/pricing" },
  { icon: Truck, label: "Shipping", path: "/admin/shipping" },
  { icon: FilePenLine, label: "Site Content", path: "/admin/site-content" },
  { icon: Megaphone, label: "Campaigns", path: "/admin/campaigns" },
  { icon: TicketPercent, label: "Coupons", path: "/admin/coupons" },
  { icon: Award, label: "Loyalty", path: "/admin/loyalty" },
  { icon: GitBranch, label: "Referrals", path: "/admin/referrals" },
  { icon: Link2, label: "Integrations", path: "/admin/integrations" },
  { icon: Activity, label: "Monitoring", path: "/admin/monitoring" },
  { icon: Bell, label: "Alerts", path: "/admin/alerts" },
  { icon: Bell, label: "Ops Center", path: "/admin/notifications" },
  { icon: Bell, label: "Email Tmpl", path: "/admin/email-templates" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
];

const NAV_SECTIONS = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    items: ["/admin", "/admin/analytics"],
  },
  {
    id: "catalog",
    title: "Catalog",
    icon: Package,
    items: ["/admin/products", "/admin/brands", "/admin/categories", "/admin/pricing"],
  },
  {
    id: "orders-sales",
    title: "Orders & Sales",
    icon: ShoppingCart,
    items: ["/admin/orders", "/admin/coupons", "/admin/loyalty", "/admin/referrals"],
  },
  {
    id: "customers",
    title: "Customers",
    icon: Users,
    items: ["/admin/users"],
  },
  {
    id: "procurement",
    title: "Procurement",
    icon: ClipboardList,
    items: ["/admin/procurement", "/admin/shipping"],
  },
  {
    id: "finance",
    title: "Finance",
    icon: DollarSign,
    items: ["/admin/payments", "/admin/payments/review", "/admin/bank-accounts", "/admin/exchange-rates"],
  },
  {
    id: "website",
    title: "Website",
    icon: Globe,
    items: ["/admin/site-content", "/admin/campaigns"],
  },
  {
    id: "operations",
    title: "Operations",
    icon: Activity,
    items: ["/admin/monitoring", "/admin/alerts", "/admin/notifications", "/admin/email-templates"],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Link2,
    items: ["/admin/integrations"],
  },
];

const DEFAULT_OPEN_SECTIONS = NAV_SECTIONS.map((section) => section.id);

function isItemActive(item, pathname) {
  return item.matchPrefix ? pathname.startsWith(item.path) : pathname === item.path;
}

export default function AdminLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN_SECTIONS);

  const groupedSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .map((path) => NAV_ITEMS.find((item) => item.path === path))
          .filter(Boolean),
      })),
    [],
  );

  useEffect(() => {
    const activeSection = groupedSections.find((section) =>
      section.items.some((item) => isItemActive(item, location.pathname)),
    );

    if (activeSection) {
      setOpenSections((current) =>
        current.includes(activeSection.id) ? current : [...current, activeSection.id],
      );
    }
  }, [groupedSections, location.pathname]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 ${collapsed ? "w-20" : "w-72"} bg-card border-r border-border transition-all duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-4 border-b border-border h-16`}>
            {!collapsed && (
              <Link to="/admin" className="font-display text-lg font-bold">
                OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
              </Link>
            )}
            <button onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }} className="p-1 rounded hover:bg-secondary">
              <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto">
            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
              {groupedSections.map((section) => {
                const SectionIcon = section.icon;
                const sectionActive = section.items.some((item) => isItemActive(item, location.pathname));

                return (
                  <AccordionItem
                    key={section.id}
                    value={section.id}
                    className={`overflow-hidden rounded-xl border ${sectionActive ? "border-[hsl(var(--accent))]/35 bg-secondary/40" : "border-border/70 bg-secondary/20"}`}
                  >
                    <AccordionTrigger
                      className={`px-3 py-3 hover:no-underline ${collapsed ? "[&>svg:last-child]:hidden justify-center" : ""}`}
                      title={collapsed ? section.title : undefined}
                    >
                      <span className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
                        <SectionIcon className={`w-4 h-4 flex-shrink-0 ${sectionActive ? "text-[hsl(var(--accent))]" : "text-muted-foreground"}`} />
                        {!collapsed && <span className="text-sm font-medium">{section.title}</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className={collapsed ? "px-2 pb-2" : "px-2 pb-3"}>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const { icon: Icon, label, path } = item;
                          const active = isItemActive(item, location.pathname);

                          return (
                            <Link
                              key={path}
                              to={path}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-3 rounded-lg text-sm transition-all ${
                                active
                                  ? "bg-secondary font-medium text-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                              } ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`}
                              title={collapsed ? label : undefined}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              {!collapsed && <span className="truncate">{label}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </nav>

          <div className="p-3 border-t border-border space-y-1">
            <button onClick={toggleTheme}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 w-full ${collapsed ? "justify-center" : ""}`}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
            </button>
            <Link to="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 ${collapsed ? "justify-center" : ""}`}>
              <ChevronLeft className="w-4 h-4" />
              {!collapsed && "Back to Store"}
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="h-16 border-b border-border flex items-center px-6 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-display text-lg font-bold">
            OUTLET<span className="text-[hsl(var(--accent))]">HUB</span>
          </span>
        </div>
        <div className="p-6 lg:p-8 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
