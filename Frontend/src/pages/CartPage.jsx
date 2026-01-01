// src/pages/CartPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CartPage.css";
import { API_BASE, mediaUrl } from "../lib/api";
import { getDiscountedPrice } from "../lib/pricing";

const API = API_BASE;

// Helper to handle mixed data types from backend vs local storage
function normalizeItems(items) {
  if (!items) return [];

  if (!Array.isArray(items) && typeof items === "object") {
    return Object.entries(items).map(([key, value]) => {
      const val = value || {};
      const prod = val.product || val.details || {};
      const id = prod.id ?? val.id ?? key;
      const qty = val.qty || val.quantity || val.count || 1;
      return { id, qty, product: prod };
    });
  }

  return (items || [])
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        return { id: item, qty: 1, product: {} };
      }
      return {
        id: item.id || item.product_id || item.product?.id,
        qty: item.qty || item.quantity || 1,
        product: item.product || item.details || {},
      };
    })
    .filter((i) => i.id !== undefined && i.id !== null);
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stockCheckLoading, setStockCheckLoading] = useState(false);
  const [stockErrorPopup, setStockErrorPopup] = useState(null); // { message, items }
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
            const normalized = normalizeItems(data.items);

            // Fetch product details for every ID
            const productIds = [...new Set(normalized.map((i) => i.id))];

            const productData = await Promise.all(
              productIds.map((id) =>
                fetch(`${API}/api/products/${id}/`).then((r) => r.json()),
              ),
            );

            const productMap = {};
            productData.forEach((p) => (productMap[p.id] = p));

            const enriched = normalized.map((item) => ({
              ...item,
              product: productMap[item.id] || {},
            }));

            setCartItems(enriched);
          } else {
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

  const loadGuestCart = async () => {
    const guest = JSON.parse(localStorage.getItem("guest_cart") || "[]");
    const normalized = normalizeItems(guest);

    // Fetch product details
    const productIds = [...new Set(normalized.map((i) => i.id))];

    const productData = await Promise.all(
      productIds.map((id) =>
        fetch(`${API}/api/products/${id}/`).then((r) => r.json()),
      ),
    );

    const productMap = {};
    productData.forEach((p) => (productMap[p.id] = p));

    const enriched = normalized.map((item) => ({
      ...item,
      product: productMap[item.id] || {},
    }));

    setCartItems(enriched);
  };

  // Helper to enrich normalized items with existing product data
  const enrichWithExistingProducts = (normalizedItems, existingItems) => {
    // Create a map of existing product data
    const productMap = {};
    existingItems.forEach((item) => {
      if (item.product && Object.keys(item.product).length > 0) {
        productMap[item.id] = item.product;
      }
    });

    // Enrich normalized items with existing product data
    return normalizedItems.map((item) => ({
      ...item,
      product: productMap[item.id] || item.product || {},
    }));
  };

  // --- ACTIONS ---
  const handleIncrease = async (productId) => {
    if (token) {
      try {
        const res = await fetch(`${API}/api/cart/add/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ product_id: productId }),
        });

        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeItems(data.items);
          // Preserve existing product data
          const enriched = enrichWithExistingProducts(normalized, cartItems);
          setCartItems(enriched);
          window.dispatchEvent(new Event("cartUpdated"));
        }
      } catch (error) {
        console.error("Error adding item:", error);
      }
    } else {
      const updated = cartItems.map((item) =>
        item.id === productId ? { ...item, qty: item.qty + 1 } : item,
      );
      setCartItems(updated);
      localStorage.setItem("guest_cart", JSON.stringify(updated));
      window.dispatchEvent(new Event("cartUpdated"));
    }
  };

  const handleDecrease = async (productId) => {
    if (token) {
      try {
        const res = await fetch(`${API}/api/cart/remove/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ product_id: productId }),
        });

        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeItems(data.items);
          // Preserve existing product data
          const enriched = enrichWithExistingProducts(normalized, cartItems);
          setCartItems(enriched);
          window.dispatchEvent(new Event("cartUpdated"));
        }
      } catch (error) {
        console.error("Error removing item:", error);
      }
    } else {
      let updated = cartItems
        .map((item) => {
          if (item.id === productId) return { ...item, qty: item.qty - 1 };
          return item;
        })
        .filter((item) => item.qty > 0);

      setCartItems(updated);
      localStorage.setItem("guest_cart", JSON.stringify(updated));
      window.dispatchEvent(new Event("cartUpdated"));
    }
  };

  // Calculate Totals
  const subtotal = cartItems.reduce((sum, item) => {
    const unitPrice = getDiscountedPrice(item.product);
    const price = Number.isFinite(unitPrice) ? unitPrice : 0;
    return sum + price * item.qty;
  }, 0);

  const shipping = subtotal > 1000 ? 0 : 50;
  const total = subtotal + shipping;

  // --- STOCK VALIDATION BEFORE CHECKOUT ---
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setStockCheckLoading(true);
    setStockErrorPopup(null);

    try {
      // Fetch fresh product data to get current stock levels
      const productIds = cartItems.map((item) => item.id);
      const freshProductData = await Promise.all(
        productIds.map((id) =>
          fetch(`${API}/api/products/${id}/`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      const stockIssues = [];
      const validItems = [];
      const itemsToRemove = [];

      cartItems.forEach((item, index) => {
        const freshProduct = freshProductData[index];

        if (!freshProduct) {
          // Product no longer exists
          stockIssues.push({
            id: item.id,
            name: item.product?.name || `Product #${item.id}`,
            issue: "no longer available",
            requestedQty: item.qty,
            availableStock: 0,
            action: "removed",
          });
          itemsToRemove.push(item.id);
        } else if (freshProduct.stock <= 0) {
          // Out of stock
          stockIssues.push({
            id: item.id,
            name: freshProduct.name,
            issue: "out of stock",
            requestedQty: item.qty,
            availableStock: 0,
            action: "removed",
          });
          itemsToRemove.push(item.id);
        } else if (freshProduct.stock < item.qty) {
          // Insufficient stock - will be adjusted
          stockIssues.push({
            id: item.id,
            name: freshProduct.name,
            issue: "insufficient stock",
            requestedQty: item.qty,
            availableStock: freshProduct.stock,
            action: "adjusted",
          });
          validItems.push({
            ...item,
            qty: freshProduct.stock,
            product: { ...item.product, ...freshProduct },
          });
        } else {
          // Stock is fine
          validItems.push({
            ...item,
            product: { ...item.product, ...freshProduct },
          });
        }
      });

      if (stockIssues.length > 0) {
        // Update cart with valid items only (with adjusted quantities)
        setCartItems(validItems);

        // Update cart in backend or localStorage
        if (token) {
          // For backend cart, we need to sync the changes
          // First clear, then re-add valid items
          try {
            await fetch(`${API}/api/cart/clear/`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });

            // Re-add valid items
            for (const item of validItems) {
              for (let i = 0; i < item.qty; i++) {
                await fetch(`${API}/api/cart/add/`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ product_id: item.id }),
                });
              }
            }
          } catch (err) {
            console.error("Error updating cart:", err);
          }
        } else {
          // Update guest cart
          const guestCartData = validItems.map((item) => ({
            id: item.id,
            qty: item.qty,
          }));
          localStorage.setItem("guest_cart", JSON.stringify(guestCartData));
        }

        window.dispatchEvent(new Event("cartUpdated"));

        // Show popup
        setStockErrorPopup({
          message: "Some items in your cart had stock issues:",
          items: stockIssues,
        });
      } else {
        // All items are valid, proceed to checkout
        navigate("/checkout", { state: { cartItems: validItems, total } });
      }
    } catch (err) {
      console.error("Stock validation error:", err);
      setStockErrorPopup({
        message: "Unable to verify stock. Please try again.",
        items: [],
      });
    } finally {
      setStockCheckLoading(false);
    }
  };

  const closeStockPopup = () => {
    setStockErrorPopup(null);
  };

  if (loading)
    return (
      <div className="loader-container">
        <div className="spinner"></div>
      </div>
    );

  return (
    <div className="page-wrapper">
      <main className="cart-container">
        <h1 className="page-title">Your Cart</h1>

        {cartItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add something to make it happy!</p>
            <Link to="/" className="btn-primary">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="cart-grid">
            {/* Left side items */}
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-card">
                  <div className="cart-card-image">
                    <Link to={`/product/${item.id}`} className="cart-card-image-link">
                      {item.product?.image_url ? (
                        <img
                          src={mediaUrl(item.product.image_url)}
                          alt={item.product.name}
                        />
                      ) : (
                        <div className="img-placeholder">No Image</div>
                      )}
                    </Link>
                  </div>

                  <div className="cart-card-details">
                    <div className="details-top">
                      <h3>{item.product?.name || `Product #${item.id}`}</h3>
                      <span className="item-price">
                        ₺
                        {Number(
                          (getDiscountedPrice(item.product) || 0) * item.qty,
                        ).toLocaleString("tr-TR")}
                      </span>
                    </div>

                    <p>Stock: {item.product?.stock}</p>

                    <div className="details-bottom">
                      <div className="qty-control">
                        <button
                          onClick={() => handleDecrease(item.id)}
                          disabled={loading}
                        >
                          -
                        </button>
                        <span>{item.qty}</span>
                        <button
                          onClick={() => handleIncrease(item.id)}
                          disabled={loading}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="cart-summary-wrapper">
              <div className="cart-summary-box">
                <h2>Order Summary</h2>

                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>₺{subtotal.toLocaleString("tr-TR")}</span>
                </div>

                <div className="summary-row">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "Free" : `₺${shipping}`}</span>
                </div>

                <div className="summary-row total">
                  <span>Total</span>
                  <span>₺{total.toLocaleString("tr-TR")}</span>
                </div>

                <button
                  className="btn-checkout"
                  onClick={handleCheckout}
                  disabled={stockCheckLoading}
                >
                  {stockCheckLoading ? "Checking stock..." : "Checkout"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stock Error Popup */}
        {stockErrorPopup && (
          <div className="stock-popup-overlay" onClick={closeStockPopup}>
            <div
              className="stock-popup"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-popup-header">
                <span className="stock-popup-icon">⚠️</span>
                <h3>Cart Updated</h3>
                <button className="stock-popup-close" onClick={closeStockPopup}>
                  ✕
                </button>
              </div>

              <p className="stock-popup-message">{stockErrorPopup.message}</p>

              {stockErrorPopup.items.length > 0 && (
                <ul className="stock-popup-list">
                  {stockErrorPopup.items.map((item, index) => (
                    <li key={index} className={`stock-item ${item.action}`}>
                      <span className="stock-item-name">{item.name}</span>
                      <span className="stock-item-detail">
                        {item.action === "removed" ? (
                          <span className="removed-badge">Removed</span>
                        ) : (
                          <>
                            <span className="adjusted-badge">Adjusted</span>
                            <span className="qty-change">
                              {item.requestedQty} → {item.availableStock}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="stock-item-reason">
                        {item.issue === "out of stock"
                          ? "Out of stock"
                          : item.issue === "no longer available"
                            ? "Product unavailable"
                            : `Only ${item.availableStock} available`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="stock-popup-actions">
                <button className="btn-popup-primary" onClick={closeStockPopup}>
                  OK, Got it
                </button>
                {cartItems.length > 0 && (
                  <button
                    className="btn-popup-secondary"
                    onClick={() => {
                      closeStockPopup();
                      handleCheckout();
                    }}
                  >
                    Try Checkout Again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
