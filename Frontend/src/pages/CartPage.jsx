// src/pages/CartPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CartPage.css";

const API = "http://127.0.0.1:8000";

// Helper to handle mixed data types from backend vs local storage
function normalizeItems(items) {
  if (!items) return [];

  // If backend returns an object keyed by product id (edge case)
  if (!Array.isArray(items) && typeof items === "object") {
    return Object.entries(items).map(([key, value]) => {
      const val = value || {};
      const prod = val.product || val.details || {};
      const id = prod.id ?? val.id ?? key;
      const qty = val.qty || val.quantity || val.count || 1;
      return { id, qty, product: prod };
    });
  }

  // Standard array processing
  return (items || [])
    .map((item) => {
      // Handle simple list of IDs if necessary
      if (typeof item === "number" || typeof item === "string") {
        return { id: item, qty: 1, product: {} };
      }
      return {
        id: item.id || item.product_id || item.product?.id,
        qty: item.qty || item.quantity || 1,
        // Ensure we have a product object even if empty
        product: item.product || item.details || {}, 
      };
    })
    .filter((i) => i.id !== undefined && i.id !== null);
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("accessToken"); 
  const navigate = useNavigate();

  // --- FETCH CART ---
  useEffect(() => {
    async function fetchCart() {
      setLoading(true);
      try {
        if (token) {
          // Logged-in: Fetch from Backend
          const res = await fetch(`${API}/api/cart/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setCartItems(normalizeItems(data.items));
          } else {
            // Fallback if token is invalid
            loadGuestCart();
          }
        } else {
          loadGuestCart();
        }
      } catch (err) {
        console.error("Cart fetch failed:", err);
        loadGuestCart();
      } finally {
        setLoading(false);
      }
    }
    fetchCart();
  }, [token]);

  const loadGuestCart = () => {
    const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
    setCartItems(normalizeItems(guest));
  };

  // --- ACTIONS ---

  const handleIncrease = async (productId) => {
    if (token) {
      // Backend Logic: POST to /add_to_cart
      try {
        const res = await fetch(`${API}/api/add_to_cart/`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ product_id: productId })
        });
        if (res.ok) {
            const data = await res.json();
            setCartItems(normalizeItems(data.items));
        }
      } catch (error) {
        console.error("Error adding item:", error);
      }
    } else {
      // Guest Logic
      const updated = cartItems.map(item => 
        item.id === productId ? { ...item, qty: item.qty + 1 } : item
      );
      setCartItems(updated);
      localStorage.setItem("guest_cart", JSON.stringify(updated));
    }
  };

  const handleDecrease = async (productId) => {
    if (token) {
      // Backend Logic: POST to /remove_from_cart
      try {
        const res = await fetch(`${API}/api/remove_from_cart/`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ product_id: productId })
        });
        if (res.ok) {
            const data = await res.json();
            setCartItems(normalizeItems(data.items));
        }
      } catch (error) {
        console.error("Error removing item:", error);
      }
    } else {
      // Guest Logic
      let updated = cartItems.map(item => {
        if (item.id === productId) return { ...item, qty: item.qty - 1 };
        return item;
      }).filter(item => item.qty > 0);
      
      setCartItems(updated);
      localStorage.setItem("guest_cart", JSON.stringify(updated));
    }
  };

  // Calculate Totals
  const subtotal = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.product?.price || 0);
    return sum + (price * item.qty);
  }, 0);

  const shipping = subtotal > 1000 ? 0 : 50; // Example logic
  const total = subtotal + shipping;

  if (loading) return <div className="loader-container"><div className="spinner"></div></div>;

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="nav-content">
            <Link to="/" className="brand-logo">ShopName</Link>
            <div className="nav-links">
                <Link to="/favorites">Favorites</Link>
                <Link to="/cart" className="active-link">Cart ({cartItems.length})</Link>
                {token ? <Link to="/profile">Profile</Link> : <Link to="/login">Login</Link>}
            </div>
        </div>
      </nav>

      <main className="cart-container">
        <h1 className="page-title">Your Cart</h1>

        {cartItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added anything to your cart yet.</p>
            <Link to="/" className="btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="cart-grid">
            {/* Left Side: Items */}
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-card">
                  <div className="cart-card-image">
                    {/* Placeholder if no image */}
                    {item.product?.image ? (
                        <img src={item.product.image} alt={item.product.name} />
                    ) : (
                        <div className="img-placeholder">No Image</div>
                    )}
                  </div>
                  
                  <div className="cart-card-details">
                    <div className="details-top">
                        <h3>{item.product?.name || `Product #${item.id}`}</h3>
                        <span className="item-price">
                             ${Number(item.product?.price || 0).toLocaleString()}
                        </span>
                    </div>
                    <p className="item-desc">{item.product?.description?.slice(0, 60)}...</p>
                    
                    <div className="details-bottom">
                        <div className="qty-control">
                            <button onClick={() => handleDecrease(item.id)} disabled={loading}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <span>{item.qty}</span>
                            <button onClick={() => handleIncrease(item.id)} disabled={loading}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Side: Summary */}
            <div className="cart-summary-wrapper">
                <div className="cart-summary-box">
                    <h2>Order Summary</h2>
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>${subtotal.toLocaleString()}</span>
                    </div>
                    <div className="summary-row">
                        <span>Shipping Estimate</span>
                        <span>{shipping === 0 ? "Free" : `$${shipping}`}</span>
                    </div>
                    <div className="summary-row">
                        <span>Tax Estimate</span>
                        <span>Calculated at checkout</span>
                    </div>
                    <div className="divider"></div>
                    <div className="summary-row total">
                        <span>Order Total</span>
                        <span>${total.toLocaleString()}</span>
                    </div>
                    
                    <button 
                        className="btn-checkout"
                        onClick={() => navigate("/checkout", { state: { cartItems, total } })}
                    >
                        Checkout
                    </button>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}