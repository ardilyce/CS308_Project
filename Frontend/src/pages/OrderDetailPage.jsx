import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getOrderById, cancelOrder, cancelOrderItem, requestRefund, getMyRefunds } from "../lib/orders.js";
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
  const [itemCancelling, setItemCancelling] = useState({});
  const [itemCancelMessages, setItemCancelMessages] = useState({});
  const [reviewInputs, setReviewInputs] = useState({});
  const [reviewSubmitting, setReviewSubmitting] = useState({});
  const [reviewMessages, setReviewMessages] = useState({});
  const [refundSelections, setRefundSelections] = useState({});
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [refundLoading, setRefundLoading] = useState(false);

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

  const loadRefunds = useCallback(async () => {
    if (!order?.id) return;
    setRefundLoading(true);
    const result = await getMyRefunds();
    if (result.ok) {
      setRefunds((result.data || []).filter((r) => r.order === order.id));
    } else if (result.requiresAuth) {
      setRefundLoading(false);
      navigate("/login");
      return;
    } else {
      setRefundMessage({ type: "error", text: result.error || "Could not load refunds." });
    }
    setRefundLoading(false);
  }, [order, navigate]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  useEffect(() => {
    if (!order?.items) return;
    const usageByItem = {};
    refunds.forEach((refund) => {
      if (refund.status === "REJECTED") return;
      (refund.items || []).forEach((it) => {
        usageByItem[it.order_item] = (usageByItem[it.order_item] || 0) + it.quantity;
      });
    });

    setRefundSelections((prev) => {
      const next = { ...prev };
      order.items.forEach((item) => {
        const remaining = Math.max(0, item.quantity - (usageByItem[item.id] || 0));
        const current = next[item.id];
        if (!current) {
          next[item.id] = { selected: false, quantity: remaining > 0 ? 1 : 0 };
        } else if (remaining === 0 && current.selected) {
          next[item.id] = { ...current, selected: false, quantity: 0 };
        } else if (remaining > 0 && current.quantity > remaining) {
          next[item.id] = { ...current, quantity: remaining };
        }
      });
      return next;
    });
  }, [order, refunds]);

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

  const handleRefundToggle = (itemId, maxQty) => {
    setRefundSelections((prev) => {
      const current = prev[itemId] || { selected: false, quantity: maxQty > 0 ? 1 : 0 };
      const quantity = Math.min(Math.max(current.quantity || 1, 1), maxQty || 0);
      return {
        ...prev,
        [itemId]: { ...current, selected: !current.selected && maxQty > 0, quantity },
      };
    });
  };

  const handleRefundQuantity = (itemId, maxQty, value) => {
    const qty = Math.min(Math.max(Number(value) || 1, 1), maxQty);
    setRefundSelections((prev) => ({
      ...prev,
      [itemId]: { selected: true, quantity: qty },
    }));
  };

  const handleRefundSubmit = async () => {
    if (!order) return;
    setRefundMessage(null);

    const usageByItem = {};
    refunds.forEach((refund) => {
      if (refund.status === "REJECTED") return;
      (refund.items || []).forEach((it) => {
        usageByItem[it.order_item] = (usageByItem[it.order_item] || 0) + it.quantity;
      });
    });

    const items = (order.items || [])
      .map((item) => {
        if (!deliveredProductIds.has(item.product)) return null;
        const remaining = Math.max(0, item.quantity - (usageByItem[item.id] || 0));
        const selection = refundSelections[item.id];
        if (!selection?.selected || remaining <= 0) return null;
        const quantity = Math.min(selection.quantity || 0, remaining);
        if (quantity <= 0) return null;
        return { order_item_id: item.id, quantity };
      })
      .filter(Boolean);

    if (!items.length) {
      setRefundMessage({ type: "error", text: "Select at least one delivered item to refund." });
      return;
    }

    setRefundSubmitting(true);
    const result = await requestRefund(order.id, {
      reason: refundReason.trim(),
      items,
    });
    setRefundSubmitting(false);

    if (!result.ok) {
      if (result.requiresAuth) {
        navigate("/login");
        return;
      }
      setRefundMessage({ type: "error", text: result.error || "Could not submit refund." });
      return;
    }

    setRefundMessage({
      type: "success",
      text: "Refund request submitted. We'll email you once it's reviewed.",
    });
    setRefundReason("");
    setRefundSelections({});
    await loadRefunds();
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
  const now = Date.now();
  const orderDate = new Date(order.created_at).getTime();
  const daysSincePurchase = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
  const refundWindowOpen = daysSincePurchase <= 30;
  const deliveredProductIds = new Set(
    (order.deliveries || [])
      .filter((delivery) => delivery.status === "DELIVERED")
      .map((delivery) => delivery.product)
  );
  const shippedOrDeliveredProductIds = new Set(
    (order.deliveries || [])
      .filter((delivery) => ["SHIPPED", "DELIVERED"].includes(delivery.status))
      .map((delivery) => delivery.product)
  );
  const isRefundEligible = refundWindowOpen && deliveredProductIds.size > 0;

  const canCancel = !["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status);

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

  const handleCancelItem = async (itemId) => {
    if (!window.confirm("Cancel this item from the order?")) {
      return;
    }

    setItemCancelling((prev) => ({ ...prev, [itemId]: true }));
    setItemCancelMessages((prev) => ({ ...prev, [itemId]: null }));

    const result = await cancelOrderItem(orderId, itemId);

    if (result.ok) {
      const refreshed = await getOrderById(orderId);
      if (refreshed.ok) {
        setOrder(refreshed.data);
      }
      setItemCancelMessages((prev) => ({
        ...prev,
        [itemId]: { type: "success", text: "Item cancelled." },
      }));
    } else {
      setItemCancelMessages((prev) => ({
        ...prev,
        [itemId]: { type: "error", text: result.error || "Failed to cancel item." },
      }));
    }

    setItemCancelling((prev) => ({ ...prev, [itemId]: false }));
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
              <div style={styles.itemActionsRow}>
                {item.is_cancelled ? (
                  <span style={styles.itemCancelledBadge}>Cancelled</span>
                ) : shippedOrDeliveredProductIds.has(item.product) ? (
                  <span style={styles.itemLockedBadge}>Shipped</span>
                ) : order.status === "PROCESSING" ? (
                  <button
                    style={{
                      ...styles.itemCancelButton,
                      opacity: itemCancelling[item.id] ? 0.7 : 1,
                      cursor: itemCancelling[item.id] ? "not-allowed" : "pointer",
                    }}
                    onClick={() => handleCancelItem(item.id)}
                    disabled={itemCancelling[item.id]}
                  >
                    {itemCancelling[item.id] ? "Cancelling..." : "Cancel item"}
                  </button>
                ) : (
                  <span style={styles.itemLockedBadge}>Cancellation closed</span>
                )}
                {itemCancelMessages[item.id]?.text && (
                  <span
                    style={{
                      ...styles.itemCancelMessage,
                      color:
                        itemCancelMessages[item.id].type === "success"
                          ? "#155724"
                          : "#c53030",
                      backgroundColor:
                        itemCancelMessages[item.id].type === "success"
                          ? "#d4edda"
                          : "#f8d7da",
                    }}
                  >
                    {itemCancelMessages[item.id].text}
                  </span>
                )}
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

      {/* Refunds */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Returns & refunds</h3>
        {!isRefundEligible && (
          <div style={styles.refundNotice}>
            {!refundWindowOpen
              ? "The 30-day refund window has expired for this order."
              : "Refunds are available after delivery is completed."}
          </div>
        )}

        {isRefundEligible && (
          <div style={styles.refundBox}>
            <p style={styles.refundHelper}>
              Select delivered items to return within 30 days of purchase. Stock will be replenished after the manager approves your request.
            </p>
            {(order.items || []).map((item) => {
              const usage = refunds
                .filter((r) => r.status !== "REJECTED")
                .flatMap((r) => r.items || [])
                .filter((it) => it.order_item === item.id)
                .reduce((sum, it) => sum + it.quantity, 0);
              const isDelivered = deliveredProductIds.has(item.product);
              const remaining = isDelivered ? Math.max(0, item.quantity - usage) : 0;
              const selection = refundSelections[item.id] || { selected: false, quantity: remaining > 0 ? 1 : 0 };

              return (
                <div key={item.id} style={styles.refundItemRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.refundItemName}>{item.product_name}</div>
                    <div style={styles.refundItemMeta}>
                      Purchased qty: {item.quantity} · Refundable left: {remaining}
                    </div>
                  </div>
                  {!isDelivered ? (
                    <span style={styles.refundTag}>Awaiting delivery</span>
                  ) : remaining > 0 ? (
                    <div style={styles.refundControls}>
                      <label style={styles.refundCheckbox}>
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          onChange={() => handleRefundToggle(item.id, remaining)}
                        />
                        Request refund
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={remaining}
                        value={selection.quantity}
                        disabled={!selection.selected}
                        onChange={(e) => handleRefundQuantity(item.id, remaining, e.target.value)}
                        style={styles.refundQtyInput}
                      />
                    </div>
                  ) : (
                    <span style={styles.refundTag}>Fully requested</span>
                  )}
                </div>
              );
            })}

            <label style={styles.refundReasonLabel}>
              Reason (optional)
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Why are you returning these items?"
                style={styles.refundReason}
                rows={3}
              />
            </label>

            {refundMessage && (
              <div
                style={{
                  ...styles.refundMessage,
                  backgroundColor: refundMessage.type === "success" ? "#d4edda" : "#f8d7da",
                  color: refundMessage.type === "success" ? "#155724" : "#c53030",
                }}
              >
                {refundMessage.text}
              </div>
            )}

            <button
              style={{
                ...styles.refundButton,
                opacity: refundSubmitting ? 0.8 : 1,
                cursor: refundSubmitting ? "not-allowed" : "pointer",
              }}
              onClick={handleRefundSubmit}
              disabled={refundSubmitting}
            >
              {refundSubmitting ? "Submitting..." : "Submit refund request"}
            </button>
          </div>
        )}

        <div style={styles.refundList}>
          <h4 style={styles.sectionSubTitle}>Your refund requests</h4>
          {refundLoading ? (
            <p style={{ color: "#666" }}>Loading refunds...</p>
          ) : refunds.length === 0 ? (
            <p style={{ color: "#666" }}>You have not requested any refunds for this order.</p>
          ) : (
            refunds.map((refund) => (
              <div key={refund.id} style={styles.refundEntry}>
                <div>
                  <div style={styles.refundMetaRow}>
                    <span style={styles.refundId}>Refund #{refund.id}</span>
                    <span
                      style={refund.status === "REJECTED" ? styles.refundStatusRejected : styles.refundStatus}
                    >
                      {refund.status}
                    </span>
                  </div>
                  <div style={styles.refundItemsLine}>
                    {(refund.items || []).map((it) => `${it.product_name} × ${it.quantity}`).join(", ")}
                  </div>
                  {refund.reason && <div style={styles.refundReasonText}>Reason: {refund.reason}</div>}
                  {refund.refunded_amount && (
                    <div style={styles.refundReasonText}>
                      Refunded: ₺{parseFloat(refund.refunded_amount).toFixed(2)}{" "}
                      {refund.refund_transaction_id && `· TX: ${refund.refund_transaction_id}`}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
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
                {(() => {
                  const rawStatus =
                    delivery.order_status === "CANCELLED"
                      ? "CANCELLED"
                      : delivery.status || delivery.order_status;
                  const config = statusConfig[rawStatus] || statusConfig.PROCESSING;
                  return (
                <span
                  style={{
                    ...styles.deliveryStatus,
                    backgroundColor: config.bg,
                    color: config.text,
                  }}
                >
                  {config.label}
                </span>
                  );
                })()}
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
  itemActionsRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  itemCancelButton: {
    padding: "8px 12px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
  },
  itemCancelledBadge: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  itemLockedBadge: {
    backgroundColor: "#e5e7eb",
    color: "#374151",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  itemCancelMessage: {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "12px",
    fontWeight: "600",
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
  refundNotice: {
    backgroundColor: "#fff5f5",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
    fontSize: "14px",
  },
  refundBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
  },
  refundHelper: {
    fontSize: "13px",
    color: "#374151",
    marginBottom: "12px",
  },
  refundItemRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
    flexWrap: "wrap",
  },
  refundItemName: {
    fontWeight: "600",
    color: "#111827",
  },
  refundItemMeta: {
    color: "#6b7280",
    fontSize: "13px",
  },
  refundControls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  refundCheckbox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#374151",
  },
  refundQtyInput: {
    width: "80px",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
  },
  refundReasonLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    color: "#111827",
    marginTop: "8px",
  },
  refundReason: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "14px",
    resize: "vertical",
  },
  refundMessage: {
    marginTop: "8px",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
  },
  refundButton: {
    marginTop: "12px",
    padding: "12px 18px",
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "600",
  },
  refundTag: {
    backgroundColor: "#e5e7eb",
    color: "#374151",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
  },
  refundList: {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "14px",
  },
  sectionSubTitle: {
    fontSize: "15px",
    fontWeight: "600",
    marginBottom: "8px",
    color: "#1a1a2e",
  },
  refundEntry: {
    borderTop: "1px solid #f1f5f9",
    padding: "10px 0",
  },
  refundMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    flexWrap: "wrap",
  },
  refundId: {
    fontWeight: "600",
    color: "#111827",
  },
  refundStatus: {
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "#e0f2fe",
    color: "#0ea5e9",
    fontSize: "12px",
    fontWeight: "600",
  },
  refundStatusRejected: {
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontSize: "12px",
    fontWeight: "600",
  },
  refundItemsLine: {
    fontSize: "13px",
    color: "#4b5563",
  },
  refundReasonText: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "4px",
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
