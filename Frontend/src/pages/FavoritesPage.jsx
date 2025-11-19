// src/pages/FavoritesPage.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function FavoritesPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            textDecoration: "none",
            color: "#111827",
          }}
        >
          ShopName
        </Link>
      </header>

      <h1>Favorites</h1>
      <p>Favorites feature will be implemented later.</p>
    </div>
  );
}