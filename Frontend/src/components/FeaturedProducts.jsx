// src/components/FeaturedProducts.jsx
import { useEffect, useState } from "react";
import { fetchProducts } from "../api/products";
import ProductCard from "./ProductCard";

export default function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProducts();
        const list = Array.isArray(data) ? data : data.results || [];
        setProducts(list.slice(0, 8)); // ilk 8 ürün
      } catch (err) {
        console.error(err);
        setError("Ürünler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading featured products...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!products.length) return <p>No products available.</p>;

  return (
    <section style={{ marginTop: "3rem" }}>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1rem",
          textAlign: "center",
        }}
      >
        Featured Products
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
