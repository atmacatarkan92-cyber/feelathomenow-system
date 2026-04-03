import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import PlatformSidebar from "./PlatformSidebar";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

function PlatformLayout() {
  const { user, loading, isPlatformAdminAuthenticated } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const shellClass = isDark ? "bg-[#07090f] text-[#eef2ff]" : "bg-[#f8fafc] text-[#0f172a]";
  const mainClass = isDark ? "bg-[#07090f]" : "bg-[#f8fafc]";
  const scrollbarStyle = isDark
    ? { scrollbarColor: "rgba(255,255,255,0.12) #07090f" }
    : { scrollbarColor: "rgba(15,23,42,0.2) #f8fafc" };
  const loadingTextClass = isDark ? "text-[#6b7a9a]" : "text-[#64748b]";

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${shellClass} ${loadingTextClass}`}
      >
        <p>Lade …</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isPlatformAdminAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className={`flex min-h-screen ${shellClass}`}>
      <PlatformSidebar />
      <div
        className={`flex min-h-screen flex-1 flex-col overflow-auto p-4 md:p-10 ${mainClass}`}
        style={scrollbarStyle}
      >
        <Outlet />
      </div>
    </div>
  );
}

export default PlatformLayout;
