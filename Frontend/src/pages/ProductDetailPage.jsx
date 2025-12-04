// src/pages/ProductDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE, mediaUrl } from "../lib/api";
import { addToCart } from "../lib/cart";
import { fetchWishlistProductIds, toggleWishlistProduct } from "../lib/wishlist";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem("accessToken")));
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

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
    const syncAuth = () => {
      setIsLoggedIn(Boolean(localStorage.getItem("accessToken")));
    };

    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isLoggedIn) {
      setInWishlist(false);
      setCheckingWishlist(false);
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
  }, [id, isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);
    setReviewError("");

    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/products/${id}/reviews/`);
        if (!cancelled) {
          const data = res.data;
          const list = Array.isArray(data) ? data : data?.results || [];
          setReviews(list);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setReviewError("Failed to load reviews.");
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
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
        showPopup("Item added to cart (guest)");
      } else {
        showPopup("Item added to cart");
      }
    } else {
      showPopup(result.error || "Failed to add item.");
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    setWishlistBusy(true);
    const result = await toggleWishlistProduct(product.id);

    if (!result.ok) {
      if (result.requiresAuth) {
        showPopup("Login to save items to your wishlist");
      } else {
        showPopup(result.error || "Failed to update wishlist.");
      }
      setWishlistBusy(false);
      return;
    }

    setInWishlist(result.inWishlist);
    showPopup(result.inWishlist ? "Added to wishlist" : "Removed from wishlist");
    setWishlistBusy(false);
  };

  const handleReviewChange = (e) => {
    const { name, value } = e.target;
    setReviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewError("");

    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    const ratingNum = Number(reviewForm.rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      setReviewError("Rating must be between 1 and 5.");
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await axios.post(`${API_BASE}/api/products/${id}/reviews/`, {
        rating: ratingNum,
        comment: reviewForm.comment.trim(),
      });

      setReviews((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return [res.data, ...arr];
      });

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              review_count: (prev.review_count || 0) + 1,
              avg_rating:
                prev.avg_rating && prev.review_count
                  ? (prev.avg_rating * prev.review_count + ratingNum) /
                    (prev.review_count + 1)
                  : ratingNum,
            }
          : prev
      );

      setReviewForm({ rating: 5, comment: "" });
      showPopup("Review submitted");
    } catch (err) {
      console.error(err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (Array.isArray(err?.response?.data?.non_field_errors) &&
          err.response.data.non_field_errors[0]) ||
        (typeof err?.response?.data === "string" ? err.response.data : null);
      setReviewError(detail || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (dt) => {
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p>No product data.</p>;

  return (
    <div className="product-detail-page">
      {popup && <div className="popup">{popup}</div>}

      <div className="product-detail-content">
        <div className="product-detail-image">
          {product.image_url ? (
            <img src={mediaUrl(product.image_url)} alt={product.name} />
          ) : (
            <div className="image-placeholder">No image</div>
          )}
        </div>

        <div className="product-detail-info">
          <h1>{product.name}</h1>
          <p className="brand">{product.brand}</p>
          <p className="price">
            {product.price != null
              ? `${Number(product.price).toLocaleString("tr-TR")} TL`
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
              {!isLoggedIn
                ? "Login to add to wishlist"
                : wishlistBusy || checkingWishlist
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

      <div className="reviews-section">
        <div className="reviews-header">
          <div>
            <h2>Ratings &amp; Reviews</h2>
            <p className="reviews-sub">
              Share your experience with this product.
            </p>
          </div>
          <div className="rating-summary">
            <div className="rating-score">
              {product.avg_rating ? product.avg_rating.toFixed(1) : "-"}
            </div>
            <div className="rating-count">
              {product.review_count || 0} review
              {(product.review_count || 0) === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="form-row">
            <label htmlFor="rating">Your rating</label>
            <select
              id="rating"
              name="rating"
              value={reviewForm.rating}
              onChange={handleReviewChange}
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="comment">Comment</label>
            <textarea
              id="comment"
              name="comment"
              value={reviewForm.comment}
              onChange={handleReviewChange}
              placeholder="Tell others what you liked or disliked"
              rows={3}
            />
          </div>
          {reviewError && <p className="review-error">{reviewError}</p>}
          <button
            type="submit"
            className="btn-primary review-submit"
            disabled={submittingReview}
          >
            {submittingReview ? "Sending..." : "Submit review"}
          </button>
        </form>

        <div className="review-list">
          {reviewsLoading ? (
            <p className="muted">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="muted">No reviews yet.</p>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="review-card">
                <div className="review-header">
                  <div className="review-rating">{rev.rating}/5</div>
                  <div className="review-meta">
                    <span className="review-user">
                      {rev.user_name || rev.user}
                    </span>
                    <span className="dot">|</span>
                    <span className="review-date">
                      {formatDate(rev.created_at)}
                    </span>
                  </div>
                </div>
                {rev.comment ? (
                  <p className="review-body">{rev.comment}</p>
                ) : (
                  <p className="review-body muted">No comment provided.</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
