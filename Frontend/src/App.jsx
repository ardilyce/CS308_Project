import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/MainLayout.jsx";
import ChatWidget from "./components/ChatWidget.jsx";

import HomePage from "./pages/HomePage.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import OrderHistoryPage from "./pages/OrderHistoryPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import SupportAgentPage from "./pages/SupportAgentPage";
import ProductManagerPage from "./pages/ProductManagerPage";
import SalesManagerPage from "./pages/SalesManagerPage";

export default function App() {
  return (
    <>
      <Routes>
          {/* Pages that should show the shared navbar/layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            
            {/* Profile Routes */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/orders" element={<OrderHistoryPage />} />
            <Route path="/profile/orders/:orderId" element={<OrderDetailPage />} />

            {/* Admin/Manager Routes */}
            <Route path="/support-agent" element={<SupportAgentPage />} />
            <Route path="/product-manager" element={<ProductManagerPage />} />
            <Route path="/sales-manager" element={<SalesManagerPage />} />
          </Route>

          {/* Auth routes (no navbar) */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
      </Routes>
      <ChatWidget />
    </>
  );
}
