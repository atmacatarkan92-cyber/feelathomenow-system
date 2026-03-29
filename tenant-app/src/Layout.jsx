import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Home, FileText, Receipt, AlertTriangle,
  Users, Phone, Bell, UserCircle, Shield, Menu, X, LogOut, ChevronRight, ClipboardCheck, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tenantNav = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Meine Unterkunft", icon: Home, page: "MyAccommodation" },
  { name: "Services", icon: Sparkles, page: "Services" },
  { name: "Übergabeprotokolle", icon: ClipboardCheck, page: "HandoverProtocols" },
  { name: "Dokumente", icon: FileText, page: "Documents" },
  { name: "Rechnungen", icon: Receipt, page: "Invoices" },
  { name: "Schaden melden", icon: AlertTriangle, page: "DamageReports" },
  { name: "Kontakte", icon: Users, page: "Contacts" },
  { name: "Notfall", icon: Phone, page: "Emergency" },
  { name: "Mitteilungen", icon: Bell, page: "Announcements" },
  { name: "Profil", icon: UserCircle, page: "Profile" },
];

const adminNav = [
  { name: "Admin", icon: Shield, page: "Admin" },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? [...tenantNav, ...adminNav] : tenantNav;

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --primary: 24 100% 58%;
          --primary-foreground: 0 0% 100%;
          --secondary: 210 100% 12%;
          --secondary-foreground: 0 0% 100%;
        }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <img 
            src="https://media.base44.com/images/public/69b1fb087eaad111e37b7816/2eefc4c2c_IMG-20260206-WA0002.jpg" 
            alt="Vantio" 
            className="h-8 w-auto"
          />
          <span className="font-semibold text-slate-900 text-sm">Vantio</span>
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://media.base44.com/images/public/69b1fb087eaad111e37b7816/2eefc4c2c_IMG-20260206-WA0002.jpg" 
              alt="Vantio" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">Vantio</h1>
              <p className="text-xs text-slate-500">Mein Zuhause</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-white" : "text-slate-400")} />
                {item.name}
                {item.page === "Announcements" && (
                  <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">Neu</Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                {user.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user.full_name || user.email}</p>
                <p className="text-xs text-slate-500 truncate">{isAdmin ? "Administrator" : "Mieter"}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Abmelden
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}