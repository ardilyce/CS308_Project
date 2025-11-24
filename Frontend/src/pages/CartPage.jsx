// src/pages/CartPage.jsx
import React from "react";
import { useLocation, Link } from "react-router-dom";
import "./CartPage.css";

export default function CartPage() {
  const location = useLocation();
  const product = location.state?.product || null;

  return (
    <div className="cart-container">
      <header className="cart-header">
        <Link to="/" className="logo">
          ShopName
        </Link>
      </header>

      <h1 className="cart-title">Your Cart</h1>

      {!product && (
        <div className="empty-cart">
          <p>Your cart is empty 🛒</p>
          <Link to="/" className="btn-back">
            Continue Shopping
          </Link>
        </div>
      )}

      {product && (
        <div className="cart-content">
          <div className="cart-item">
            <div className="cart-item-image">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="image-placeholder">No Image</div>
              )}
            </div>

            <div className="cart-item-info">
              <h2>{product.name}</h2>
              <p className="brand">{product.brand}</p>
              <p className="price">
                {product.price != null
                  ? `₺${Number(product.price).toLocaleString("tr-TR")}`
                  : "Price N/A"}
              </p>
              {product.category && <p>Category: {product.category}</p>}
              {product.stock != null && <p>Stock: {product.stock}</p>}
            </div>
          </div>

          <div className="cart-summary">
            <h2>Order Summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>
                {product.price != null
                  ? `₺${Number(product.price).toLocaleString("tr-TR")}`
                  : "-"}
              </span>
            </div>

            <button className="checkout-btn">Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
}
