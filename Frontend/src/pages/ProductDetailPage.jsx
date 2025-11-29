// src/pages/ProductDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../lib/api";
import { addToCart } from "../lib/cart";
import {
  fetchWishlistProductIds,
  toggleWishlistProduct,
} from "../lib/wishlist";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState("");
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setInWishlist(false);
      return;
    }

    setCheckingWishlist(true);

    (async () => {
      const res = await fetchWishlistProductIds();
      if (cancelled) return;

      if (res.ok) {
        setInWishlist(res.productIds.includes(Number(id)));
      } else if (res.error && !res.requiresAuth) {
        console.warn("Wishlist status error:", res.error);
      }

      setCheckingWishlist(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const showPopup = (message) => {
    setPopup(message);
    setTimeout(() => setPopup(""), 3000);
  };

  const handleAddToCart = async () => {
    if (!product) return;

    const result = await addToCart(product.id, product.stock);

    if (result.ok) {
      if (result.guest) {
        showPopup("Item added to cart (guest) 🛒");
      } else {
        showPopup("Item added to cart 🛒");
      }
    } else {
      showPopup(result.error || "Failed to add item.");
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;

    setWishlistBusy(true);
    const result = await toggleWishlistProduct(product.id);

    if (!result.ok) {
      if (result.requiresAuth) {
        showPopup("Login to save items to your wishlist ❤️");
      } else {
        showPopup(result.error || "Failed to update wishlist.");
      }
      setWishlistBusy(false);
      return;
    }

    setInWishlist(result.inWishlist);
    showPopup(
      result.inWishlist ? "Added to wishlist ❤️" : "Removed from wishlist"
    );
    setWishlistBusy(false);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p>No product data.</p>;

  return (
    <div className="product-detail-page">
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

          <div className="product-detail-actions">
            <button
              onClick={handleAddToCart}
              className="btn-primary action-btn"
              disabled={product.stock <= 0}
            >
              {product.stock <= 0 ? "Out of stock" : "Add to cart"}
            </button>

            <button
              onClick={handleWishlistToggle}
              className={`btn-secondary wishlist-btn action-btn ${
                inWishlist ? "active" : ""
              }`}
              disabled={wishlistBusy || checkingWishlist}
            >
              {wishlistBusy || checkingWishlist
                ? "Saving..."
                : inWishlist
                ? "In wishlist"
                : "Add to wishlist"}
            </button>

            <Link to="/cart" className="btn-secondary action-btn">
              Go to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
