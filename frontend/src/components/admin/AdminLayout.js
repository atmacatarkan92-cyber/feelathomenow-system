import React from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { ADMIN_TOKEN_KEY } from "../../config";

function AdminLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/admin/login";
  const hasToken = typeof localStorage !== "undefined" && localStorage.getItem(ADMIN_TOKEN_KEY);

  if (isLoginPage) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <AdminSidebar />
        <div style={{ flex: 1, padding: "40px" }}>
          <h1>FeelAtHomeNow Admin</h1>
          <Outlet />
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: "40px" }}>
        <h1>FeelAtHomeNow Admin</h1>
        <Outlet />
      </div>
    </div>
  );
}

export default AdminLayout;