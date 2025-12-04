// src/pages/FavoritesPage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./FavoritesPage.css";
import { fetchWishlistProductIds } from "../lib/wishlist";
import { fetchProductDetail } from "../api/products";
import { mediaUrl } from "../lib/api";

export default function FavoritesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    (async () => {
      const res = await fetchWishlistProductIds();

      if (!res.ok) {
        setError(res.error || "Unable to load favorites");
        setLoading(false);
        return;
      }

      if (!res.productIds.length) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          res.productIds.map((pid) =>
            fetchProductDetail(pid).catch(() => null)
          )
        );
        setProducts(results.filter(Boolean));
      } catch (err) {
        console.error(err);
        setError("Failed to load some favorite items.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="favorites-page">
      <h1>Favorites</h1>

      {!token ? (
        <p>
          Please <Link to="/login">login</Link> to view your favorites.
        </p>
      ) : loading ? (
        <p>Loading favorites...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <p>No favorites yet.</p>
          <p>Add items from product pages using “Add to wishlist”.</p>
        </div>
      ) : (
        <div className="favorites-grid">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              className="favorite-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {p.image_url ? (
                <img src={mediaUrl(p.image_url)} alt={p.name} />
              ) : (
                <div
                  style={{
                    height: 160,
                    borderRadius: 10,
                    background: "#f3f4f6",
                    display: "grid",
                    placeItems: "center",
                    color: "#9ca3af",
                  }}
                >
                  No image
                </div>
              )}

              <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                {p.brand}
              </div>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="price">
                {p.price != null
                  ? `₺${Number(p.price).toLocaleString("tr-TR")}`
                  : "Price N/A"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
