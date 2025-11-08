import React from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";

export default function HomePage() {
  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">ShopName</div>
        <input
          type="text"
          placeholder="Search products..."
          className="search-bar"
        />
        <div className="nav-icons">
          <Link to="/favorites" className="nav-icon">❤️</Link>
          <Link to="/cart" className="nav-icon">🛒</Link>
          <Link to="/login" className="nav-icon">👤</Link>
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
        <img 
          src="/auth-illustration.png" 
          alt="hero" 
          className="hero-image" 
        />
      </section>

      {/* Categories */}
      <section className="categories">
        <h2>Categories</h2>
        <div className="category-grid">
          <div className="category-card">👕<p>Clothes</p></div>
          <div className="category-card">👟<p>Shoes</p></div>
          <div className="category-card">🕶️<p>Accessories</p></div>
          <div className="category-card">💄<p>Beauty</p></div>
          <div className="category-card">🏠<p>Home</p></div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured">
        <h2>Featured Products</h2>
        <div className="product-grid">
          {[1, 2, 3, 4].map((item) => (
            <div className="product-card" key={item}>
              <div className="image-placeholder"></div>
              <p>Product {item}</p>
              <span>$49.99</span>
              <button className="add-btn">Add to Cart</button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 ShopName | About | Contact | Help</p>
      </footer>
    </div>
  );
}
