import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "../components/ui/sonner";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ChatWidget from "../components/ChatWidget";
import AdminLayout from "../components/admin/AdminLayout";

import AdminUebersichtPage from "../pages/admin/AdminUebersichtPage";
import AdminCoLivingDashboardPage from "../pages/admin/AdminCoLivingDashboardPage";
import AdminApartmentsPage from "../pages/admin/AdminApartmentsPage";
import AdminLeadsPage from "../pages/admin/AdminLeadsPage";
import AdminTenantsPage from "../pages/admin/AdminTenantsPage";
import AdminLandlordsPage from "../pages/admin/AdminLandlordsPage";
import AdminUnitDetailPage from "../pages/admin/AdminUnitDetailPage";
import AdminInvoicesPage from "../pages/admin/AdminInvoicesPage";
import AdminInvoiceDetailPage from "../pages/admin/AdminInvoiceDetailPage";
import AdminBusinessApartmentsDashboardPage from "../pages/admin/AdminBusinessApartmentsDashboardPage";
import AdminObjektePage from "../pages/admin/AdminObjektePage";
import AdminRoomsPage from "../pages/admin/AdminRoomsPage";
import AdminOccupancyPage from "../pages/admin/AdminOccupancyPage";
import AdminRevenuePage from "../pages/admin/AdminRevenuePage";
import AdminExpensesPage from "../pages/admin/AdminExpensesPage";
import AdminPerformancePage from "../pages/admin/AdminPerformancePage";
import AdminBreakEvenPage from "../pages/admin/AdminBreakEvenPage";
import AdminForecastPage from "../pages/admin/AdminForecastPage";
import AdminPropertyManagersPage from "../pages/admin/AdminPropertyManagersPage";
import AdminListingsPage from "../pages/admin/AdminListingsPage";
import AdminLoginPage from "../pages/admin/AdminLoginPage";

const HomePage = lazy(() => import("../pages/HomePage"));
const ApartmentsPage = lazy(() => import("../pages/ApartmentsPage"));
const ApartmentDetailPage = lazy(() => import("../pages/ApartmentDetailPage"));
const ForCompaniesPage = lazy(() => import("../pages/ForCompaniesPage"));
const ForPropertyManagersPage = lazy(() => import("../pages/ForPropertyManagersPage"));
const AboutPage = lazy(() => import("../pages/AboutPage"));
const ContactPage = lazy(() => import("../pages/ContactPage"));

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function AppRouter() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="App">
      <ScrollToTop />
      {!isAdminRoute && <Header />}
      <main>
        <Suspense fallback={<div className="text-center py-20">Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/apartments" element={<ApartmentsPage />} />
            <Route path="/wohnungen/:city" element={<ApartmentsPage />} />
            <Route path="/apartments/:id" element={<ApartmentDetailPage />} />
            <Route path="/for-companies" element={<ForCompaniesPage />} />
            <Route path="/for-property-managers" element={<ForPropertyManagersPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route path="login" element={<AdminLoginPage />} />
              <Route index element={<AdminUebersichtPage />} />
              <Route path="operations" element={<AdminCoLivingDashboardPage />} />
              <Route path="business-apartments-dashboard" element={<AdminBusinessApartmentsDashboardPage />} />
              <Route path="objekte-dashboard" element={<AdminObjektePage />} />
              <Route path="rechnungen-dashboard" element={<AdminInvoicesPage />} />
              <Route path="apartments" element={<AdminApartmentsPage />} />
              <Route path="listings" element={<AdminListingsPage />} />
              <Route path="leads" element={<AdminLeadsPage />} />
              <Route path="tenants" element={<AdminTenantsPage />} />
              <Route path="landlords" element={<AdminLandlordsPage />} />
              <Route path="bewirtschafter" element={<AdminPropertyManagersPage />} />
              <Route path="invoices" element={<AdminInvoicesPage />} />
              <Route path="invoices/:id" element={<AdminInvoiceDetailPage />} />
              <Route path="revenue" element={<AdminRevenuePage />} />
              <Route path="ausgaben" element={<AdminExpensesPage />} />
              <Route path="performance" element={<AdminPerformancePage />} />
              <Route path="break-even" element={<AdminBreakEvenPage />} />
              <Route path="prognose" element={<AdminForecastPage />} />
              <Route path="units/:unitId" element={<AdminUnitDetailPage />} />
              <Route path="invoices/open" element={<AdminInvoicesPage />} />
              <Route path="invoices/paid" element={<AdminInvoicesPage />} />
              <Route path="invoices/overdue" element={<AdminInvoicesPage />} />
              <Route path="units" element={<Navigate to="/admin/apartments" replace />} />
              <Route path="rooms" element={<AdminRoomsPage />} />
              <Route path="occupancy" element={<AdminOccupancyPage />} />
              <Route path="tenants/active" element={<AdminTenantsPage />} />
              <Route path="tenants/move-outs" element={<AdminTenantsPage />} />
              <Route path="owners" element={<AdminLandlordsPage />} />
              <Route path="contracts" element={<AdminLandlordsPage />} />
              <Route path="leads/inquiries" element={<AdminLeadsPage />} />
              <Route path="leads/followups" element={<AdminLeadsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
      <Toaster position="top-center" />
      {!isAdminRoute && <ChatWidget />}
    </div>
  );
}
