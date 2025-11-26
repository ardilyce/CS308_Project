// src/pages/HomePage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import FeaturedProducts from "../components/FeaturedProducts";
import { fetchCategories } from "../api/categories";

export default function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState("");

  // Fetch categories from backend
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

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <h1>Electronics for every need</h1>
          <p>Smartphones, laptops, TVs and more – all in one place.</p>

          <div className="hero-buttons">
            <button
              className="btn-primary"
              onClick={() => navigate("/search?q=smartphone")}
            >
              Shop Smartphones
            </button>

            <button
              className="btn-secondary"
              onClick={() => navigate("/search")}
            >
              Explore Categories
            </button>
          </div>
        </div>

        <img
          src="/auth-illustration.png"
          alt="Hero"
          className="hero-image"
        />
      </section>

      {/* CATEGORIES */}
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

      {/* FEATURED PRODUCTS */}
      <FeaturedProducts />

      {/* FOOTER */}
      <footer className="footer">
        <p>2025 ShopName | About | Contact | Help</p>
      </footer>
    </div>
  );
}
