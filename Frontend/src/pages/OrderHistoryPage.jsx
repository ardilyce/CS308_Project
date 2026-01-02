import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyOrders } from "../lib/orders.js";

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

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function fetchOrders() {
      try {
        const result = await getMyOrders();
        
        if (!isMounted) return;

        if (!result.ok) {
          if (result.error === "Please log in to view orders") {
            navigate("/login");
            return;
          }
          setError(result.error || "Failed to load orders");
        } else {
          setOrders(Array.isArray(result.data) ? result.data : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>My Orders</h2>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={{ color: "#666", marginTop: 16 }}>Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>My Orders</h2>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>⚠️ {error}</p>
          <button onClick={() => window.location.reload()} style={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>My Orders</h2>
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>You haven't placed any orders yet.</p>
          <Link to="/" style={styles.shopLink}>
            Start Shopping →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>My Orders</h2>
      <div style={styles.orderList}>
        {orders.map((order) => {
          const status = statusConfig[order.status] || { label: order.status || "Unknown", bg: "#e9ecef", text: "#495057" };
          const formattedDate = order.created_at 
            ? new Date(order.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "N/A";

          return (
            <Link
              key={order.id}
              to={`/profile/orders/${order.id}`}
              style={styles.orderCard}
            >
              <div style={styles.orderHeader}>
                <span style={styles.orderId}>Order #{order.id}</span>
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

              <div style={styles.orderDetails}>
                <div style={styles.detailRow}>
                  <span style={styles.label}>Date:</span>
                  <span>{formattedDate}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.label}>Items:</span>
                  <span>{order.items?.length || 0} item(s)</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.label}>Payment:</span>
                  <span>{paymentStatusLabels[order.payment_status] || order.payment_status || "N/A"}</span>
                </div>
              </div>

              <div style={styles.orderFooter}>
                <span style={styles.totalLabel}>Total</span>
                <span style={styles.totalAmount}>
                  ₺{order.subtotal ? parseFloat(order.subtotal).toFixed(2) : "0.00"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "30px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  title: {
    fontSize: "28px",
    fontWeight: "600",
    marginBottom: "24px",
    color: "#1a1a2e",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #4361ee",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorContainer: {
    textAlign: "center",
    padding: "40px 20px",
    backgroundColor: "#fff5f5",
    borderRadius: "12px",
    border: "1px solid #fed7d7",
  },
  errorText: {
    color: "#c53030",
    marginBottom: "16px",
    fontSize: "16px",
  },
  retryButton: {
    padding: "10px 24px",
    backgroundColor: "#4361ee",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "#f8f9fa",
    borderRadius: "12px",
  },
  emptyText: {
    color: "#666",
    fontSize: "18px",
    marginBottom: "20px",
  },
  shopLink: {
    display: "inline-block",
    padding: "12px 28px",
    backgroundColor: "#4361ee",
    color: "white",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "500",
  },
  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  orderCard: {
    display: "block",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    textDecoration: "none",
    color: "inherit",
    border: "1px solid #eee",
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid #f0f0f0",
  },
  orderId: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  statusBadge: {
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  orderDetails: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "16px",
  },
  detailRow: {
    display: "flex",
    gap: "8px",
    fontSize: "14px",
  },
  label: {
    color: "#888",
  },
  orderFooter: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "8px",
    paddingTop: "12px",
    borderTop: "1px solid #f0f0f0",
  },
  totalLabel: {
    color: "#666",
    fontSize: "14px",
  },
  totalAmount: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#4361ee",
  },
};
