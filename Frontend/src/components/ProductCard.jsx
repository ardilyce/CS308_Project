// src/components/ProductCard.jsx
import { useNavigate } from "react-router-dom";

/* Ürün kartı: isim, marka, fiyat, stok vs. gösterir */
export default function ProductCard({ product }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    // Ürüne tıklayınca product info sayfasına git
    navigate(`/product/${product.id}`);
  };

  const handleGoToCart = (e) => {
    e.stopPropagation(); // kart click tetiklenmesin
    // Cart sayfasına, ürün bilgisini state ile gönder
    navigate("/cart", { state: { product } });
  };

  const priceText =
    product.price != null
      ? `₺${Number(product.price).toLocaleString("tr-TR")}`
      : "Price N/A";

  const imgSrc = product.image_url || product.image || null;

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: "12px",
        padding: "1rem",
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.5rem",
        cursor: "pointer",
      }}
      onClick={handleCardClick}
    >
      {/* Resim */}
      <div
        style={{
          width: "100%",
          height: "160px",
          borderRadius: "12px",
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.5rem",
          overflow: "hidden",
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>No image</span>
        )}
      </div>

      {/* Marka + model */}
      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
        {product.brand || product.distributor_info} · {product.model}
      </div>

      {/* İsim */}
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {product.name}
      </h3>

      {/* Fiyat */}
      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{priceText}</div>

      {/* Ek bilgiler */}
      <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
        <div>Stock: {product.stock}</div>
        {product.warranty && <div>Warranty: {product.warranty}</div>}
        <div style={{ textTransform: "capitalize" }}>
          Category: {product.category}
        </div>
      </div>

      {/* Go to cart butonu */}
      <button
        style={{
          marginTop: "0.75rem",
          width: "100%",
          padding: "0.5rem 0.75rem",
          borderRadius: "9999px",
          border: "none",
          backgroundColor: "#111827",
          color: "white",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
        onClick={handleGoToCart}
      >
        Go to cart
      </button>
    </div>
  );
}
