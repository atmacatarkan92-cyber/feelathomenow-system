import React from "react";
import { Outlet, useLocation, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navStyle = {
  display: "flex",
  gap: "16px",
  marginBottom: "24px",
  padding: "12px 0",
  borderBottom: "1px solid #E5E7EB",
};

const linkStyle = (active) => ({
  color: active ? "#EA580C" : "#475569",
  fontWeight: active ? 700 : 500,
  textDecoration: "none",
});

function LandlordLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === "/landlord/login";
  const { isLandlordAuthenticated, loading, logout } = useAuth();

  if (isLoginPage) {
    return (
      <div style={{ minHeight: "100vh", padding: "24px" }}>
        <Outlet />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Lade …</p>
      </div>
    );
  }

  if (!isLandlordAuthenticated) {
    return <Navigate to="/landlord/login" replace />;
  }

  const handleLogout = () => {
    logout().then(() => navigate("/landlord/login", { replace: true }));
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <nav style={navStyle}>
        <Link to="/landlord" style={linkStyle(location.pathname === "/landlord" || location.pathname === "/landlord/")}>
          Übersicht
        </Link>
        <Link to="/landlord/properties" style={linkStyle(location.pathname === "/landlord/properties")}>
          Properties
        </Link>
        <Link to="/landlord/units" style={linkStyle(location.pathname === "/landlord/units")}>
          Units
        </Link>
        <Link to="/landlord/tenancies" style={linkStyle(location.pathname === "/landlord/tenancies")}>
          Mietverhältnisse
        </Link>
        <Link to="/landlord/invoices" style={linkStyle(location.pathname === "/landlord/invoices")}>
          Rechnungen
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          style={{ marginLeft: "auto", padding: "6px 12px", cursor: "pointer", color: "#64748B" }}
        >
          Abmelden
        </button>
      </nav>
      <Outlet />
    </div>
  );
}

export default LandlordLayout;
