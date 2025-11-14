import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./HomePage.css";
import { API_BASE } from "../lib/api";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sections, setSections] = useState({
    categories: [],
    products: [],
    brands: [],
  });
  const navigate = useNavigate();

  // Search when Enter is pressed on the navbar input
  const handleKeyPress = async (e) => {
    if (e.key === "Enter" && query.trim() !== "") {
      try {
        const res = await axios.get(
          `${API_BASE}/api/search/?q=${encodeURIComponent(query)}`
        );
        if (res.data.ok) {
          setResults(res.data.results);
          navigate(`/search?q=${encodeURIComponent(query)}`, {
            state: { results: res.data.results },
          });
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchHomepage = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/home/`);
        if (!mounted) return;

        if (res.data?.ok) {
          const apiSections = res.data.sections || {};
          setSections({
            categories: apiSections.featured_categories || [],
            products: apiSections.featured_products || [],
            brands: apiSections.trending_brands || [],
          });
          setError("");
        } else {
          setError("Unable to load homepage data.");
        }
      } catch (err) {
        console.error("Homepage fetch failed:", err);
        if (mounted) setError("Unable to load homepage data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHomepage();
    return () => {
      mounted = false;
    };
  }, []);

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price ?? 0);

  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">ShopName</div>
        <input
          type="text"
          placeholder="Search products..."
          className="search-bar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <div className="nav-icons">
          <Link to="/favorites" className="nav-icon">
            Favorites
          </Link>
          <Link to="/cart" className="nav-icon">
            Cart
          </Link>
          <Link to="/login" className="nav-icon">
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-text">
          <h1>Find your next favorite outfit</h1>
          <p>Discover new arrivals, deals, and exclusive collections.</p>
          <div className="hero-buttons">
            <button className="btn-primary">Shop Now</button>
            <button className="btn-secondary">Explore Categories</button>
          </div>
        </div>
        <img src="/auth-illustration.png" alt="hero" className="hero-image" />
      </section>

      {/* Categories */}
      <section className="categories">
        <h2>Featured Categories</h2>
        {loading ? (
          <p>Loading categories...</p>
        ) : sections.categories.length ? (
          <div className="category-grid">
            {sections.categories.map((category) => (
              <div className="category-card" key={category.id}>
                <p>{category.name}</p>
                <span className="category-slug">/{category.slug}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No categories available yet.</p>
        )}
      </section>

      {/* Featured Products */}
      <section className="featured">
        <h2>Featured Products</h2>
        {loading ? (
          <p>Loading products...</p>
        ) : sections.products.length ? (
          <div className="product-grid">
            {sections.products.map((product) => (
              <div className="product-card" key={product.id}>
                <div className="image-placeholder" />
                <p className="product-name">{product.name}</p>
                <span className="product-brand">
                  {product.brand || "Unknown brand"}
                </span>
                <span className="product-price">
                  {formatPrice(product.price)}
                </span>
                <span className="product-stock">
                  Stock: {product.stock ?? 0}
                </span>
                <button className="add-btn">Add to Cart</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No featured products yet.</p>
        )}
      </section>

      {/* Trending Brands */}
      <section className="trending-brands">
        <h2>Trending Brands</h2>
        {loading ? (
          <p>Loading brands...</p>
        ) : sections.brands.length ? (
          <ul>
            {sections.brands.map((brand) => (
              <li key={brand}>{brand}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-text">No trending brands to show.</p>
        )}
      </section>

      {error && <div className="error-banner">{error}</div>}

      {/* Footer */}
      <footer className="footer">
        <p>2025 ShopName | About | Contact | Help</p>
      </footer>
    </div>
  );
}
