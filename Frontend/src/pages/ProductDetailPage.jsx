// src/pages/ProductDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE, mediaUrl } from "../lib/api";
import { addToCart } from "../lib/cart";
import { fetchWishlistProductIds, toggleWishlistProduct } from "../lib/wishlist";
import { getStoredUser } from "../lib/auth";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState("");

  // Check if user is a staff role (not a customer)
  const user = getStoredUser();
  const isStaffRole = user?.role && user.role !== "customer";

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
          setCurrentPage(1);
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

  useEffect(() => {
    if (!product) return;
    let cancelled = false;

    const slugify = (text) =>
      (text || "")
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const fetchRelated = async () => {
      setRelatedLoading(true);
      setRelatedError("");
      const tryCategoryFallback = Boolean(product.brand) && product.category;

      const buildProducts = (data) => {
        const normalized = Array.isArray(data) ? data : data?.results || [];
        return normalized.filter((p) => p.id !== product.id);
      };

      const request = async (params) => {
        const res = await axios.get(`${API_BASE}/api/products/`, { params });
        return buildProducts(res.data);
      };

      try {
        let productsList = [];
        if (product.brand) {
          productsList = await request({ brand: product.brand });
        } else if (product.category) {
          productsList = await request({ category: slugify(product.category) });
        }

        if (!cancelled && productsList.length === 0 && tryCategoryFallback) {
          productsList = await request({ category: slugify(product.category) });
        }

        if (!cancelled) {
          setRelatedProducts(productsList.slice(0, 6));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setRelatedError("Could not load related products.");
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    };

    fetchRelated();

    return () => {
      cancelled = true;
    };
  }, [product]);

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

  const formatDate = (dt) => {
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  };

  const REVIEWS_PER_PAGE = 5;
  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReviews = reviews.slice(
    (safePage - 1) * REVIEWS_PER_PAGE,
    safePage * REVIEWS_PER_PAGE,
  );

  if (loading) return <p>Loading...</p>;
  
  if (error || !product) {
    return (
      <div className="product-not-found">
        <div className="not-found-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <h1 className="not-found-title">Product Not Found</h1>
        <p className="not-found-message">
          This product has been removed or doesn't exist anymore.
        </p>
        <Link to="/" className="not-found-btn">
          Back to Homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      {popup && <div className="popup">{popup}</div>}

      <div className="product-detail-layout">
        <div className="product-detail-main">
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

              {/* Only show cart/wishlist actions for customers (not staff) */}
              {!isStaffRole && (
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
              )}
            </div>
          </div>

          <div className="reviews-section">
            <div className="reviews-header">
              <div>
                <h2>Ratings &amp; Reviews</h2>
                <p className="reviews-sub">
                  Hear what others think about this product.
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

            {reviewError && <p className="review-error">{reviewError}</p>}

            <div className="review-list">
              {reviewsLoading ? (
                <p className="muted">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <p className="muted">No reviews yet.</p>
              ) : (
                paginatedReviews.map((rev) => (
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

            {reviews.length > REVIEWS_PER_PAGE && (
              <div className="reviews-pagination">
                <button
                  className="page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </button>
                <span className="page-indicator">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  className="page-btn"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="related-products">
          <h3>Related products</h3>
          {relatedLoading ? (
            <p className="muted">Looking for matches…</p>
          ) : relatedError ? (
            <p className="review-error">{relatedError}</p>
          ) : relatedProducts.length === 0 ? (
            <p className="muted">No related products found.</p>
          ) : (
            <div className="related-list">
              {relatedProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.id}`}
                  className="related-card"
                >
                  <div className="related-thumb">
                    {item.image_url ? (
                      <img src={mediaUrl(item.image_url)} alt={item.name} />
                    ) : (
                      <div className="thumb-placeholder">No image</div>
                    )}
                  </div>
                  <div className="related-info">
                    <p className="related-name">{item.name}</p>
                    <p className="related-meta">
                      {item.brand || "—"} •{" "}
                      {item.price != null
                        ? `${Number(item.price).toLocaleString("tr-TR")} TL`
                        : "N/A"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
