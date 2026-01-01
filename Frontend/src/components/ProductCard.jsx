import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { addToCart } from "../lib/cart";
import { mediaUrl } from "../lib/api";
import { getDiscountedPrice } from "../lib/pricing";
import { getStoredUser } from "../lib/auth";

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Check if user is a staff role (not a customer)
  const user = getStoredUser();
  const isStaffRole = user?.role && user.role !== "customer";

  const handleCardClick = () => navigate(`/product/${product.id}`);

  const handleAddToCart = async (e) => {
    e.stopPropagation();

    // ❗ Eğer ürün stokta değilse hiç bir şey yapma
    if (product.stock <= 0) return;

    setAdding(true);

    const result = await addToCart(product.id, product.stock);

    if (!result.ok) {
      // ❗ out of stock popup göstermiyoruz
      if (result.error !== "Out of stock") {
        alert(result.error);
      }
      setAdding(false);
      return;
    }

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    setAdding(false);
  };

  const unitPrice = getDiscountedPrice(product);
  const originalPrice = Number(product.price);
  const hasDiscount =
    Number.isFinite(originalPrice) &&
    unitPrice != null &&
    unitPrice < originalPrice;
  const priceText =
    unitPrice != null
      ? `${unitPrice.toLocaleString("tr-TR")} TL`
      : "Price N/A";

  const imgSrc = mediaUrl(product.image_url || product.image);

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
        position: "relative",
      }}
      onClick={handleCardClick}
    >
      {hasDiscount && (
        <div
          style={{
            position: "absolute",
            top: "0.75rem",
            left: "0.75rem",
            backgroundColor: "#dc2626",
            color: "white",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            fontSize: "0.7rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
          }}
        >
          SALE!
        </div>
      )}
      {/* Image */}
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

      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
        {product.brand || product.distributor_info || ""}
        {product.model ? ` - ${product.model}` : ""}
      </div>

      <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
        {product.name}
      </h3>

      {hasDiscount ? (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              textDecoration: "line-through",
              color: "#9ca3af",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            {`${originalPrice.toLocaleString("tr-TR")} TL`}
          </span>
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            {priceText}
          </span>
        </div>
      ) : (
        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{priceText}</div>
      )}

      {/* Only show cart actions for customers (not staff) */}
      {!isStaffRole && (
        <>
          {/* OUT OF STOCK MODE */}
          {product.stock <= 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: "0.75rem",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "9999px",
                backgroundColor: "#dc2626", // kırmızı
                color: "white",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              Out of stock
            </div>
          ) : (
            <button
              style={{
                marginTop: "0.75rem",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: added ? "#059669" : "#111827",
                transition: "0.2s",
                color: "white",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
              onClick={handleAddToCart}
              disabled={adding}
            >
              {added ? "Added to cart ✓" : adding ? "Adding..." : "Add to cart"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
