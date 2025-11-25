// src/pages/CartPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CartPage.css";

const API = "http://127.0.0.1:8000";

function normalizeItems(items) {
  if (!items) return [];

  // If backend returns an object keyed by product id
  if (!Array.isArray(items) && typeof items === "object") {
    return Object.entries(items).map(([key, value]) => {
      const val = value || {};
      const prod = val.product || val.details || {};
      const id = prod.id ?? val.id ?? key;
      const qty = val.qty || val.quantity || val.count || 1;
      return { id, qty, product: prod };
    });
  }

  // Already an array
  return (items || [])
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        return { id: item, qty: 1 };
      }
      return {
        id: item.id || item.product_id || item.product?.id,
        qty: item.qty || item.quantity || 1,
        product: item.product || item.details,
      };
    })
    .filter((i) => i.id !== undefined && i.id !== null);
}

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
          // Logged-in user: load from backend
          const res = await fetch(`${API}/api/cart/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setCartItems(normalizeItems(data.items));
          } else {
            console.warn("Cart API error, falling back to guest");
            const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
            setCartItems(normalizeItems(guest));
          }
        } else {
          // Guest cart from localStorage
          const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
          setCartItems(normalizeItems(guest));
        }
      } catch (err) {
        console.error("Cart fetch failed:", err);
        const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
        setCartItems(normalizeItems(guest));
      } finally {
        setLoading(false);
      }
    }

    fetchCart();
  }, [token]);

  if (loading) {
    return <p style={{ textAlign: "center" }}>Loading cart...</p>;
  }

  const totalItems = cartItems.reduce((sum, item) => sum + (item.qty || 1), 0);

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
          <p>Your cart is empty</p>
          <Link to="/" className="btn-back">
            Continue Shopping
          </Link>
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="cart-content">
          {/* Item list */}
          {cartItems.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}

          {/* Summary */}
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
  const name = item?.product?.name || item?.product?.title || `Product #${item.id}`;
  const price = item?.product?.price;
  return (
    <div className="cart-item">
      <p>
        <b>{name}</b> (ID: {item.id})
      </p>
      <p>
        <b>Quantity:</b> {item.qty || 1}
      </p>
      {price !== undefined && (
        <p>
          <b>Price:</b> ?{Number(price).toLocaleString("tr-TR")}
        </p>
      )}
    </div>
  );
}
