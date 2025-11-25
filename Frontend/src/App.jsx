import { Routes, Route } from "react-router-dom";   //src/App.jsx
import HomePage from "./pages/HomePage.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
    </Routes>
  );
}
