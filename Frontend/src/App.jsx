import { Routes, Route } from "react-router-dom";
// import MainLayout from "./components/MainLayout.jsx"; // REMOVED: This file is missing and causing the crash

import HomePage from "./pages/HomePage.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import SupportAgentPage from "./pages/SupportAgentPage";
import ProductManagerPage from "./pages/ProductManagerPage";
import ProfilePage from "./pages/ProfilePage.jsx";
import OrderHistoryPage from "./pages/OrderHistoryPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";

export default function App() {
  return (
    <Routes>
        {/* We removed the MainLayout wrapper for now to fix the crash */}
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

        {/* Auth & Admin Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/support-agent" element={<SupportAgentPage />} />
        <Route path="/product-manager" element={<ProductManagerPage />} />
    </Routes>
  );
}