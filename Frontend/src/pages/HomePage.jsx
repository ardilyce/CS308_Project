// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./HomePage.css";
import FeaturedProducts from "../components/FeaturedProducts";
import { fetchCategories } from "../api/categories";

export default function HomePage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState("");

  // Navbar’daki search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  // Kategorileri backend’den al
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchCategories();
        if (!mounted) return;
        setCategories(data);
        setCatError("");
      } catch (err) {
        console.error("Category fetch error:", err);
        if (mounted) setCatError("Unable to load categories.");
      } finally {
        if (mounted) setCatLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="home-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <Link to="/" className="logo-link">
          <span className="logo">ShopName</span>
        </Link>

        <form className="search-wrapper" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search product"
            className="search-bar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            Search
          </button>
        </form>

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

      {/* HERO (eski tasarıma çok yakın) */}
      <section className="hero">
        <div className="hero-text">
          <h1>Electronics for every need</h1>
          <p>Smartphones, laptops, TVs and more – all in one place.</p>

          <div className="hero-buttons">
            {/* Shop Smartphones → /search?q=smartphone */}
            <button
              className="btn-primary"
              onClick={() => navigate("/search?q=smartphone")}
            >
              Shop Smartphones
            </button>

            {/* Explore Categories → sadece /search (senin 2. ekran görüntün) */}
            <button
              className="btn-secondary"
              onClick={() => navigate("/search")}
            >
              Explore Categories
            </button>
          </div>
        </div>

        {/* Eski görsel */}
        <img src="/auth-illustration.png" alt="Hero" className="hero-image" />
      </section>

      {/* CATEGORIES BLOKU */}
      <section className="categories">
        <h2>Categories</h2>
        {catLoading ? (
          <p>Loading categories...</p>
        ) : catError ? (
          <p className="error-text">{catError}</p>
        ) : categories.length ? (
          <div className="category-grid">
            {categories.map((c) => (
              <div key={c.id} className="category-card">
                <div className="category-name">{c.name}</div>
                <div className="category-slug">/{c.slug}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>No categories available yet.</p>
        )}
      </section>

      {/* FEATURED PRODUCTS (yeni mantık kalıyor) */}
      <FeaturedProducts />

      <footer className="footer">
        <p>2025 ShopName | About | Contact | Help</p>
      </footer>
    </div>
  );
}
