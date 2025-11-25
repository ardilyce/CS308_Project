// src/pages/ProductDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../lib/api";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(""); // <-- NEW

  const token = localStorage.getItem("accessToken"); // <-- token нужно

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/products/${id}/`);
        setProduct(res.data);
      } catch (err) {
        console.error(err);
        setError("Product not found.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // --------------------
  // ADD TO CART HANDLER
  // --------------------
  const handleAddToCart = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cart/add/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product.id }),
      });

      const data = await res.json();
      console.log("Cart updated:", data);

      // Show popup message
      setPopup("Item added to cart! 🛒");

      // Hide popup after 3 seconds
      setTimeout(() => {
        setPopup("");
      }, 3000);
    } catch (err) {
      console.error("Failed to add to cart:", err);
      setPopup("Failed to add item.");
      setTimeout(() => setPopup(""), 3000);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p>No product data.</p>;

  return (
    <div className="product-detail-page">
      {/* POPUP */}
      {popup && <div className="popup">{popup}</div>}

      <header className="product-detail-header">
        <Link to="/" className="logo">
          ShopName
        </Link>
      </header>

      <div className="product-detail-content">
        <div className="product-detail-image">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="image-placeholder">No image</div>
          )}
        </div>

        <div className="product-detail-info">
          <h1>{product.name}</h1>
          <p className="brand">{product.brand}</p>
          <p className="price">
            {product.price != null
              ? `₺${Number(product.price).toLocaleString("tr-TR")}`
              : "Price N/A"}
          </p>

          <p>Stock: {product.stock}</p>
          <p>Category: {product.category}</p>
          {product.model && <p>Model: {product.model}</p>}
          {product.serialnumber && <p>Serial no: {product.serialnumber}</p>}
          {product.warranty && <p>Warranty: {product.warranty}</p>}

          {product.description && (
            <p className="description">{product.description}</p>
          )}

          {/* NEW: ADD TO CART BUTTON */}
          <button onClick={handleAddToCart} className="btn-primary">
            Add to cart
          </button>

          {/* Existing link (optional) */}
          <Link to="/cart" className="btn-secondary">
            Go to Cart
          </Link>
        </div>
      </div>
    </div>
  );
}
