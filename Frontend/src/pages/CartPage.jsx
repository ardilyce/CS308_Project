// src/pages/CartPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CartPage.css";

const API = "http://127.0.0.1:8000";

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("accessToken");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCart() {
      setLoading(true);

      try {
        if (token) {
          // 🔐 LOGINLI → backend cart
          const res = await fetch(`${API}/api/cart/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setCartItems(data.items || []);
          } else {
            console.warn("Cart API error — falling back to guest");
            const guest = JSON.parse(
              localStorage.getItem("guest_cart") || "[]",
            );
            setCartItems(guest);
          }
        } else {
          // 🟡 LOGIN DEGIL → guest cart
          const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
          setCartItems(guest);
        }
      } catch (err) {
        console.error("Cart fetch failed:", err);
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

  // ♻️ Toplam ürün sayısı (qty toplamı)
  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);

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
          {/* 🔥 Item list */}
          {cartItems.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}

          {/* 🔥 Summary */}
          <div className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Total Items</span>
              <span>{totalItems}</span>
            </div>

            <button
              className="checkout-btn"
              onClick={() => navigate("/checkout", { state: { cartItems } })}
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartItem({ item }) {
  return (
    <div className="cart-item">
      <p>
        <b>Product ID:</b> {item.id}
      </p>
      <p>
        <b>Quantity:</b> {item.qty}
      </p>
    </div>
  );
}
