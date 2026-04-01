import React from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

function AdminLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/admin/login";
  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const shellClass = "bg-[var(--bg-page)] text-[var(--text-primary)]";
  const mainClass = "bg-[var(--bg-page)]";
  const scrollbarStyle = isDark
    ? { scrollbarColor: "rgba(255,255,255,0.12) #07090f" }
    : { scrollbarColor: "rgba(15,23,42,0.2) #f8fafc" };
  const loadingTextClass = "text-[var(--text-muted)]";

  if (isLoginPage) {
    return (
      <div className={`flex min-h-screen ${shellClass}`}>
        <AdminSidebar />
        <div
          className={`flex min-h-screen flex-1 flex-col overflow-auto p-4 md:p-10 ${mainClass}`}
          style={scrollbarStyle}
        >
          <Outlet />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${shellClass} ${loadingTextClass}`}
      >
        <p>Lade …</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className={`flex min-h-screen ${shellClass}`}>
      <AdminSidebar />
      <div
        className={`flex min-h-screen flex-1 flex-col overflow-auto p-4 md:p-10 ${mainClass}`}
        style={scrollbarStyle}
      >
        <Outlet />
      </div>
    </div>
  );
}

export default AdminLayout;
