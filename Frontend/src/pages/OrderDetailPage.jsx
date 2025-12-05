import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getOrderById, cancelOrder } from "../lib/orders.js";
import { submitReview } from "../lib/reviews.js";
import { mediaUrl } from "../lib/api";

const statusConfig = {
  PENDING: { label: "Processing", bg: "#fff3cd", text: "#856404" },
  PROCESSING: { label: "Processing", bg: "#cce5ff", text: "#004085" },
  PAID: { label: "Processing", bg: "#d4edda", text: "#155724" },
  SHIPPED: { label: "In-Transit", bg: "#d1ecf1", text: "#0c5460" },
  DELIVERED: { label: "Delivered", bg: "#c3e6cb", text: "#155724" },
  CANCELLED: { label: "Cancelled", bg: "#f8d7da", text: "#721c24" },
};

const paymentStatusLabels = {
  PENDING: "Payment Pending",
  APPROVED: "Paid",
  DECLINED: "Payment Declined",
  REFUNDED: "Refunded",
};

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewInputs, setReviewInputs] = useState({});
  const [reviewSubmitting, setReviewSubmitting] = useState({});
  const [reviewMessages, setReviewMessages] = useState({});

  useEffect(() => {
    async function fetchOrder() {
      const result = await getOrderById(orderId);

      if (!result.ok) {
        if (result.error === "Please log in to view order") {
          navigate("/login");
          return;
        }
        setError(result.error);
      } else {
        setOrder(result.data);
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId, navigate]);

  useEffect(() => {
    if (!order?.items) return;
    setReviewInputs((prev) => {
      const next = { ...prev };
      order.items.forEach((item) => {
        if (!next[item.product]) {
          next[item.product] = { rating: 5, comment: "" };
        }
      });
      return next;
    });
  }, [order]);

  const handleCancelOrder = async () => {
    if (!window.confirm("Are you sure you want to cancel this order?")) {
      return;
    }

    setCancelling(true);
    const result = await cancelOrder(orderId);

    if (result.ok) {
      // Refresh order data
      const refreshed = await getOrderById(orderId);
      if (refreshed.ok) {
        setOrder(refreshed.data);
      }
    } else {
      alert(result.error || "Failed to cancel order");
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>⚠️ {error}</p>
          <Link to="/profile/orders" style={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>Order not found.</p>
          <Link to="/profile/orders" style={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status] || { label: order.status, bg: "#e9ecef", text: "#495057" };
  const formattedDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const canCancel = !["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status);
  const deliveredProductIds = new Set(
    (order.deliveries || [])
      .filter((delivery) => delivery.is_completed)
      .map((delivery) => delivery.product)
  );

  const handleReviewSubmit = async (productId) => {
    const draft = reviewInputs[productId] || { rating: 5, comment: "" };
    if (!draft.rating) {
      setReviewMessages((prev) => ({
        ...prev,
        [productId]: { type: "error", text: "Please select a rating." },
      }));
      return;
    }

    setReviewSubmitting((prev) => ({ ...prev, [productId]: true }));
    setReviewMessages((prev) => ({ ...prev, [productId]: null }));

    const result = await submitReview(productId, {
      rating: Number(draft.rating),
      comment: draft.comment || "",
    });

    if (!result.ok) {
      if (result.requiresAuth) {
        setReviewSubmitting((prev) => ({ ...prev, [productId]: false }));
        navigate("/login");
        return;
      }
      setReviewMessages((prev) => ({
        ...prev,
        [productId]: { type: "error", text: result.error || "Could not submit review." },
      }));
    } else {
      setReviewMessages((prev) => ({
        ...prev,
        [productId]: { type: "success", text: "Thanks for your feedback!" },
      }));
      setReviewInputs((prev) => ({
        ...prev,
        [productId]: { rating: 5, comment: "" },
      }));
    }

    setReviewSubmitting((prev) => ({ ...prev, [productId]: false }));
  };

  return (
    <div style={styles.container}>
      <Link to="/profile/orders" style={styles.backLink}>
        ← Back to Orders
      </Link>

      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Order #{order.id}</h2>
          <p style={styles.date}>{formattedDate}</p>
        </div>
        <span
          style={{
            ...styles.statusBadge,
            backgroundColor: status.bg,
            color: status.text,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Order Info Cards */}
      <div style={styles.infoCards}>
        {/* Payment Info */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>💳 Payment</h3>
          <p style={styles.cardText}>
            Status: <strong>{paymentStatusLabels[order.payment_status] || order.payment_status}</strong>
          </p>
          {order.card_last_four && (
            <p style={styles.cardText}>Card: •••• {order.card_last_four}</p>
          )}
          {order.transaction_id && (
            <p style={styles.cardTextSmall}>Transaction: {order.transaction_id}</p>
          )}
        </div>

        {/* Delivery Info */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>📦 Delivery</h3>
          <p style={styles.cardText}>{order.delivery_address}</p>
        </div>

        {/* Invoice Info */}
        {order.invoice && (
          <div style={styles.infoCard}>
            <h3 style={styles.cardTitle}>📄 Invoice</h3>
            <p style={styles.cardText}>
              Invoice #: <strong>{order.invoice.invoice_number}</strong>
            </p>
            <p style={styles.cardTextSmall}>
              Issued: {new Date(order.invoice.issue_date).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Order Items</h3>
        <div style={styles.itemsList}>
          {order.items?.map((item) => (
            <div key={item.id} style={styles.itemCard}>
              <div style={styles.itemHeader}>
                <div style={styles.itemImageContainer}>
                  {item.product_image ? (
                    <img
                      src={mediaUrl(item.product_image)}
                      alt={item.product_name}
                      style={styles.itemImage}
                    />
                  ) : (
                    <div style={styles.noImage}>📦</div>
                  )}
                </div>
                <div style={styles.itemDetails}>
                  <Link 
                    to={`/product/${item.product}`} 
                    style={styles.itemName}
                  >
                    {item.product_name}
                  </Link>
                  <p style={styles.itemMeta}>
                    Qty: {item.quantity} × ₺{parseFloat(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <div style={styles.itemPrice}>
                  ₺{parseFloat(item.line_total).toFixed(2)}
                </div>
              </div>
              {deliveredProductIds.has(item.product) ? (
                <div style={styles.reviewBox}>
                  <div style={styles.reviewHeaderRow}>
                    <span style={styles.reviewTitle}>Rate & comment</span>
                    {reviewMessages[item.product]?.text && (
                      <span
                        style={{
                          ...styles.reviewMessage,
                          color:
                            reviewMessages[item.product].type === "success"
                              ? "#155724"
                              : "#c53030",
                          backgroundColor:
                            reviewMessages[item.product].type === "success"
                              ? "#d4edda"
                              : "#f8d7da",
                        }}
                      >
                        {reviewMessages[item.product].text}
                      </span>
                    )}
                  </div>
                  <div style={styles.reviewInputsRow}>
                    <label style={styles.reviewLabel}>
                      Rating
                      <select
                        value={reviewInputs[item.product]?.rating || 5}
                        onChange={(e) =>
                          setReviewInputs((prev) => ({
                            ...prev,
                            [item.product]: {
                              ...prev[item.product],
                              rating: Number(e.target.value),
                            },
                          }))
                        }
                        style={styles.reviewSelect}
                        disabled={reviewSubmitting[item.product]}
                      >
                        {[1, 2, 3, 4, 5].map((score) => (
                          <option key={score} value={score}>
                            {score} / 5
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ ...styles.reviewLabel, flex: 1 }}>
                      Comment
                      <textarea
                        value={reviewInputs[item.product]?.comment || ""}
                        onChange={(e) =>
                          setReviewInputs((prev) => ({
                            ...prev,
                            [item.product]: {
                              ...prev[item.product],
                              comment: e.target.value,
                            },
                          }))
                        }
                        placeholder="What did you think about it?"
                        style={styles.reviewTextarea}
                        disabled={reviewSubmitting[item.product]}
                        rows={3}
                      />
                    </label>
                  </div>
                  <button
                    style={{
                      ...styles.reviewSubmit,
                      opacity: reviewSubmitting[item.product] ? 0.8 : 1,
                    }}
                    onClick={() => handleReviewSubmit(item.product)}
                    disabled={reviewSubmitting[item.product]}
                  >
                    {reviewSubmitting[item.product] ? "Submitting..." : "Submit review"}
                  </button>
                </div>
              ) : (
                <div style={styles.reviewBadge}>Available after delivery</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryRow}>
          <span>Subtotal</span>
          <span>₺{parseFloat(order.subtotal).toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span>Tax (18%)</span>
          <span>₺{parseFloat(order.tax_amount).toFixed(2)}</span>
        </div>
        <div style={styles.summaryTotal}>
          <span>Total</span>
          <span>₺{parseFloat(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      {canCancel && (
        <div style={styles.actions}>
          <button
            onClick={handleCancelOrder}
            disabled={cancelling}
            style={{
              ...styles.cancelButton,
              opacity: cancelling ? 0.6 : 1,
              cursor: cancelling ? "not-allowed" : "pointer",
            }}
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        </div>
      )}

      {/* Delivery Tracking */}
      {order.deliveries && order.deliveries.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Delivery Status</h3>
          <div style={styles.deliveryList}>
            {order.deliveries.map((delivery) => (
              <div key={delivery.id} style={styles.deliveryCard}>
                <div style={styles.deliveryInfo}>
                  <span style={styles.deliveryProduct}>{delivery.product_name}</span>
                  <span style={styles.deliveryQty}>× {delivery.quantity}</span>
                </div>
                <span
                  style={{
                    ...styles.deliveryStatus,
                    backgroundColor: delivery.is_completed ? "#c3e6cb" : "#fff3cd",
                    color: delivery.is_completed ? "#155724" : "#856404",
                  }}
                >
                  {delivery.is_completed ? "Delivered" : "In Transit"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "30px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  backLink: {
    display: "inline-block",
    color: "#4361ee",
    textDecoration: "none",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: "500",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    paddingBottom: "20px",
    borderBottom: "1px solid #eee",
  },
  title: {
    fontSize: "28px",
    fontWeight: "600",
    color: "#1a1a2e",
    margin: 0,
  },
  date: {
    color: "#666",
    fontSize: "14px",
    marginTop: "4px",
  },
  statusBadge: {
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    color: "#666",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #4361ee",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  errorContainer: {
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "#fff5f5",
    borderRadius: "12px",
    border: "1px solid #fed7d7",
  },
  errorText: {
    color: "#c53030",
    marginBottom: "20px",
    fontSize: "16px",
  },
  infoCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  infoCard: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "12px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#1a1a2e",
  },
  cardText: {
    fontSize: "14px",
    color: "#444",
    marginBottom: "4px",
  },
  cardTextSmall: {
    fontSize: "12px",
    color: "#888",
    wordBreak: "break-all",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "16px",
    color: "#1a1a2e",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  itemCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: "white",
    borderRadius: "12px",
    border: "1px solid #eee",
  },
  itemHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  itemImageContainer: {
    width: "72px",
    height: "72px",
    flexShrink: 0,
  },
  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "8px",
    backgroundColor: "#f3f4f6",
  },
  noImage: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: "8px",
    fontSize: "24px",
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: "15px",
    fontWeight: "500",
    color: "#1a1a2e",
    textDecoration: "none",
    display: "block",
    marginBottom: "4px",
    wordBreak: "break-word",
  },
  itemMeta: {
    fontSize: "13px",
    color: "#666",
    margin: 0,
  },
  itemPrice: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1a1a2e",
    marginLeft: "auto",
  },
  reviewBox: {
    width: "100%",
    backgroundColor: "#f8f9fa",
    borderRadius: "10px",
    padding: "12px",
    border: "1px solid #e5e7eb",
  },
  reviewHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  },
  reviewTitle: {
    fontWeight: "600",
    color: "#1a1a2e",
    fontSize: "14px",
  },
  reviewMessage: {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "12px",
    fontWeight: "600",
  },
  reviewInputsRow: {
    display: "flex",
    gap: "12px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  reviewLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    color: "#374151",
    minWidth: "140px",
  },
  reviewSelect: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
  },
  reviewTextarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    resize: "vertical",
  },
  reviewSubmit: {
    alignSelf: "flex-start",
    padding: "10px 16px",
    backgroundColor: "#4361ee",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
  },
  reviewBadge: {
    alignSelf: "flex-start",
    padding: "6px 10px",
    backgroundColor: "#f3f4f6",
    borderRadius: "8px",
    color: "#6b7280",
    fontSize: "12px",
    marginTop: "4px",
  },
  summary: {
    backgroundColor: "#f8f9fa",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "24px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
    fontSize: "14px",
    color: "#666",
  },
  summaryTotal: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "12px",
    borderTop: "1px solid #ddd",
    fontSize: "18px",
    fontWeight: "700",
    color: "#1a1a2e",
  },
  actions: {
    display: "flex",
    gap: "12px",
    marginBottom: "32px",
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  deliveryList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  deliveryCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
  },
  deliveryInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  deliveryProduct: {
    fontWeight: "500",
    color: "#1a1a2e",
  },
  deliveryQty: {
    color: "#666",
    fontSize: "13px",
  },
  deliveryStatus: {
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "500",
  },
};
