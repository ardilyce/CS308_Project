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

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p>No product data.</p>;

  return (
    <div className="product-detail-page">
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

          <Link to="/cart" state={{ product }} className="btn-primary">
            Go to cart
          </Link>
        </div>
      </div>
    </div>
  );
}
