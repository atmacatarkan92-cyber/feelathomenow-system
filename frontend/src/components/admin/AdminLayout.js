import React from "react";
import { Outlet, useLocation, Navigate, useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === "/admin/login";
  const { isAuthenticated, loading, user, isImpersonating, impersonatedOrganizationName, exitImpersonation } =
    useAuth();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const shellClass = isDark
    ? "bg-[#07090f] text-[#eef2ff]"
    : "bg-[#f8fafc] text-[#0f172a]";
  const mainClass = isDark
    ? "bg-[#07090f]"
    : "bg-[#f8fafc]";
  const scrollbarStyle = isDark
    ? { scrollbarColor: "rgba(255,255,255,0.12) #07090f" }
    : { scrollbarColor: "rgba(15,23,42,0.2) #f8fafc" };
  const loadingTextClass = isDark ? "text-[#6b7a9a]" : "text-[#64748b]";

  const supportBanner =
    isImpersonating && !isLoginPage ? (
      <div
        className={
          isDark
            ? "border-b border-amber-500/25 bg-amber-500/[0.12] px-4 py-2.5 text-[13px] text-[#fde68a]"
            : "border-b border-amber-400/30 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950"
        }
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span>
            Du befindest dich im Support-Modus (Organisation:{" "}
            <strong>{impersonatedOrganizationName || "—"}</strong>)
          </span>
          <button
            type="button"
            onClick={() =>
              exitImpersonation().then(() => navigate("/platform/organizations", { replace: true }))
            }
            className={
              isDark
                ? "shrink-0 rounded-[8px] border border-amber-400/35 bg-[#141824] px-3 py-1.5 text-[12px] font-semibold text-[#fde68a] hover:bg-[#1a2030]"
                : "shrink-0 rounded-[8px] border border-amber-600/25 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-950 hover:bg-amber-100/80"
            }
          >
            Zurück zur Plattform
          </button>
        </div>
      </div>
    ) : null;

  if (isLoginPage) {
    return (
      <div className={`flex min-h-screen ${shellClass}`}>
        <AdminSidebar />
        <div
          className={`flex min-h-screen flex-1 flex-col overflow-auto ${mainClass}`}
          style={scrollbarStyle}
        >
          {supportBanner}
          <div className="p-4 md:p-10">
            <Outlet />
          </div>
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

  if (user && user.role === "platform_admin") {
    return <Navigate to="/platform" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className={`flex min-h-screen ${shellClass}`}>
      <AdminSidebar />
      <div
        className={`flex min-h-screen flex-1 flex-col overflow-auto ${mainClass}`}
        style={scrollbarStyle}
      >
        {supportBanner}
        <div className="p-4 md:p-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
