import { Toaster } from "@/components/ui/toaster";
import CenterCampaignPopup from "@/components/campaigns/CenterCampaignPopup";
import LanguageProvider from "@/components/i18n/LanguageProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { SiteContentProvider } from "@/contexts/SiteContentContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import { queryClientInstance } from "@/lib/query-client";
import PageNotFound from "@/lib/PageNotFound";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Orders from "@/pages/dashboard/Orders";
import WishlistPage from "@/pages/dashboard/WishlistPage";
import AlertsPage from "@/pages/dashboard/AlertsPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import AddressesPage from "@/pages/dashboard/AddressesPage";
import PaymentsPage from "@/pages/dashboard/PaymentsPage";
import NotificationsPage from "@/pages/dashboard/NotificationsPage";
import MyRewards from "@/pages/dashboard/MyRewards";
import MyReferrals from "@/pages/dashboard/MyReferrals";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminPaymentReview from "@/pages/admin/AdminPaymentReview";
import AdminProcurement from "@/pages/admin/AdminProcurement";
import AdminBankAccounts from "@/pages/admin/AdminBankAccounts";
import AdminBrands from "@/pages/admin/AdminBrands";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminPricing from "@/pages/admin/AdminPricing";
import AdminShipping from "@/pages/admin/AdminShipping";
import AdminExchangeRates from "@/pages/admin/AdminExchangeRates";
import AdminIntegrations from "@/pages/admin/AdminIntegrations";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminMonitoring from "@/pages/admin/AdminMonitoring";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AdminEmailTemplates from "@/pages/admin/AdminEmailTemplates";
import AdminNotificationsCenter from "@/pages/admin/AdminNotificationsCenter";
import AdminSiteContent from "@/pages/admin/AdminSiteContent";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCampaigns from "@/pages/admin/AdminCampaigns";
import AdminLoyalty from "@/pages/admin/AdminLoyalty";
import AdminReferrals from "@/pages/admin/AdminReferrals";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Shop />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/checkout" element={<Checkout />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Orders />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/dashboard/wishlist" element={<WishlistPage />} />
          <Route path="/dashboard/alerts" element={<AlertsPage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />
          <Route path="/dashboard/addresses" element={<AddressesPage />} />
          <Route path="/dashboard/payments" element={<PaymentsPage />} />
          <Route path="/dashboard/rewards" element={<MyRewards />} />
          <Route path="/dashboard/referrals" element={<MyReferrals />} />
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={["SUPER_ADMIN", "ADMIN"]}
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/payments/review" element={<AdminPaymentReview />} />
          <Route path="/admin/bank-accounts" element={<AdminBankAccounts />} />
          <Route path="/admin/exchange-rates" element={<AdminExchangeRates />} />
          <Route path="/admin/procurement" element={<AdminProcurement />} />
          <Route path="/admin/brands" element={<AdminBrands />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/pricing" element={<AdminPricing />} />
          <Route path="/admin/shipping" element={<AdminShipping />} />
          <Route path="/admin/site-content" element={<AdminSiteContent />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/loyalty" element={<AdminLoyalty />} />
          <Route path="/admin/referrals" element={<AdminReferrals />} />
          <Route path="/admin/integrations" element={<AdminIntegrations />} />
          <Route path="/admin/monitoring" element={<AdminMonitoring />} />
          <Route path="/admin/alerts" element={<AdminAlerts />} />
          <Route path="/admin/notifications" element={<AdminNotificationsCenter />} />
          <Route path="/admin/email-templates" element={<AdminEmailTemplates />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <LanguageProvider>
        <SiteContentProvider>
          <AuthProvider>
            <CartProvider>
              <CurrencyProvider>
                <ThemeProvider>
                  <QueryClientProvider client={queryClientInstance}>
                    <ScrollToTop />
                    <AppRoutes />
                    <CenterCampaignPopup />
                    <Toaster />
                  </QueryClientProvider>
                </ThemeProvider>
              </CurrencyProvider>
            </CartProvider>
          </AuthProvider>
        </SiteContentProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;
