// src/pages/CartPage.jsx
import React from "react";
import { useLocation, Link } from "react-router-dom";
import "./CartPage.css";

export default function CartPage() {
  const location = useLocation();
  const product = location.state?.product || null;

  return (
    <div className="cart-page">
      <header className="cart-header">
        <Link to="/" className="logo">
          ShopName
        </Link>
      </header>

      <h1>Your cart</h1>

      {!product && <p>Your cart is empty (frontend demo state).</p>}

      {product && (
        <div className="cart-item">
          <div className="cart-item-image">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} />
            ) : (
              <div className="image-placeholder">No image</div>
            )}
          </div>
          <div className="cart-item-info">
            <h2>{product.name}</h2>
            <p>{product.brand}</p>
            <p>
              {product.price != null
                ? `₺${Number(product.price).toLocaleString("tr-TR")}`
                : "Price N/A"}
            </p>
            <p>Stock: {product.stock}</p>
            <p>Category: {product.category}</p>
          </div>
        </div>
      )}
    </div>
  );
}