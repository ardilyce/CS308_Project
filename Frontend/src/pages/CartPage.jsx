// src/pages/CartPage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./CartPage.css";

const API = "http://127.0.0.1:8000";

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    async function fetchCart() {
      setLoading(true);

      try {
        if (token) {
          // 🔐 LOGINLI KULLANICI → BACKEND CART
          const res = await fetch(`${API}/api/cart/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            console.warn("Cart API not ok, falling back to guest cart");
            const guest = JSON.parse(
              localStorage.getItem("guest_cart") || "[]",
            );
            setCartItems(guest);
            return;
          }

          const data = await res.json();
          setCartItems(data.items || []);
        } else {
          // 🟡 LOGIN DEĞİL → LOCALSTORAGE CART
          const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
          setCartItems(guest);
        }
      } catch (err) {
        console.error("Cart fetch failed:", err);
        // Hata olursa da en azından guest cart'ı deneyelim
        const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
        setCartItems(guest);
      } finally {
        setLoading(false);
      }
    }

    fetchCart();
  }, [token]);

  if (loading) {
    return <p style={{ textAlign: "center" }}>Loading cart...</p>;
  }

  return (
    <div className="cart-container">
      <header className="cart-header">
        <Link to="/" className="logo">
          ShopName
        </Link>
      </header>

      <h1 className="cart-title">Your Cart</h1>

      {cartItems.length === 0 && (
        <div className="empty-cart">
          <p>Your cart is empty 🛒</p>
          <Link to="/" className="btn-back">
            Continue Shopping
          </Link>
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="cart-content">
          {cartItems.map((itemId) => (
            <CartItem key={itemId} productId={itemId} />
          ))}

          <div className="cart-summary">
            <h2>Order Summary</h2>
            <div className="summary-row">
              <span>Total Items</span>
              <span>{cartItems.length}</span>
            </div>

            <button className="checkout-btn">Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartItem({ productId }) {
  return (
    <div className="cart-item">
      <p>Product ID: {productId}</p>
    </div>
  );
}
