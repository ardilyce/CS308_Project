import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./CheckoutPage.css";
import { getStoredUser } from "../lib/auth";
import { createOrder } from "../lib/orders";

const initialState = {
  name: "",
  address: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
};

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CheckoutPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [invoice, setInvoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const cartItems = useMemo(() => state?.cartItems || [], [state]);
  const totalItems = cartItems.reduce((sum, i) => sum + (i.qty || 1), 0);
  const estimatedTotal = cartItems.reduce((sum, i) => {
    const price = i?.product?.price;
    const qty = i.qty || 1;
    return sum + (price ? Number(price) * qty : 99 * qty);
  }, 0);
  const loggedIn = Boolean(localStorage.getItem("accessToken"));
  const userEmail =
    getStoredUser()?.email ||
    getStoredUser()?.username ||
    getStoredUser()?.name ||
    "";
  const purchaserName =
    getStoredUser()?.name ||
    getStoredUser()?.fullName ||
    getStoredUser()?.full_name ||
    getStoredUser()?.username ||
    userEmail ||
    "Customer";
  const userAddress = getStoredUser()?.address || "";

  React.useEffect(() => {
    // Prefill with stored profile if available
    setForm((prev) => ({
      ...prev,
      name: prev.name || getStoredUser()?.name || "",
      address: prev.address || userAddress,
    }));
  }, [userAddress]);

  const updateField = (key, formatter) => (e) => {
    const value = formatter ? formatter(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Cardholder name is required";
    if (!form.address.trim()) next.address = "Shipping address is required";

    const digits = form.cardNumber.replace(/\s/g, "");
    if (digits.length !== 16) next.cardNumber = "Enter a 16-digit card number";

    const expDigits = form.expiry.replace("/", "");
    if (expDigits.length !== 4) {
      next.expiry = "Use MM/YY format";
    } else {
      const mm = Number(expDigits.slice(0, 2));
      const yy = Number(expDigits.slice(2));
      if (mm < 1 || mm > 12) next.expiry = "Month must be 01-12";
      if (Number.isNaN(yy)) next.expiry = "Year is invalid";
    }

    if (!/^[0-9]{3,4}$/.test(form.cvv)) {
      next.cvv = "CVV must be 3-4 digits";
    }

    return next;
  };

  const sendInvoiceEmail = async (payload) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/api/invoices/email/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Invoice email failed (ignored):", err);
    }
  };

  const clearCart = async () => {
    // clear guest cart
    localStorage.removeItem("guest_cart");

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // best-effort clear on backend
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/api/cart/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return;
    } catch (err) {
      console.warn("Cart DELETE failed, trying fallback:", err);
    }

    try {
      await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/api/cart/clear/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn("Cart clear fallback failed:", err);
    }
  };

  const downloadInvoice = (data) => {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    const itemsRows = data.items
      .map(
        (it) =>
          `<tr><td>${it.name}</td><td>${it.qty}</td><td>₺${Number(
            it.unitPrice,
          ).toFixed(2)}</td><td>₺${(it.lineTotal || it.qty * it.unitPrice).toFixed(2)}</td></tr>`,
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${data.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin-bottom: 4px; color: #111; }
            .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
            .meta-item { font-size: 14px; }
            .meta-label { color: #666; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; }
            th { background: #f3f4f6; font-size: 13px; text-transform: uppercase; color: #374151; }
            .totals { margin-top: 16px; text-align: right; }
            .totals div { padding: 4px 0; }
            .grand-total { font-size: 20px; font-weight: bold; border-top: 2px solid #111; padding-top: 8px; margin-top: 8px; }
            .transaction { font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice</h1>
            <div style="color: #666;">${data.id}</div>
          </div>
          <div class="meta">
            <div class="meta-item">
              <div class="meta-label">Customer</div>
              <div><b>${data.name}</b></div>
              <div>${data.email}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Invoice Date</div>
              <div>${data.date}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Delivery Address</div>
              <div>${data.address}</div>
            </div>
            ${data.transactionId ? `
            <div class="meta-item">
              <div class="meta-label">Transaction ID</div>
              <div class="transaction">${data.transactionId}</div>
            </div>
            ` : ''}
          </div>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="totals">
            ${data.subtotal ? `<div>Subtotal: ₺${data.subtotal.toFixed(2)}</div>` : ''}
            ${data.tax ? `<div>Tax (18%): ₺${data.tax.toFixed(2)}</div>` : ''}
            <div class="grand-total">Total: ₺${data.total.toFixed(2)}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setPaymentError(null);
    if (Object.keys(next).length) return;

    // Validate cart has items
    if (cartItems.length === 0) {
      setPaymentError("Your cart is empty");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare order data for backend
      const orderData = {
        items: cartItems.map((item) => ({
          product_id: item.product?.id || item.id,
          quantity: item.qty || 1,
        })),
        delivery_address: form.address,
        payment: {
          card_number: form.cardNumber,
          expiry: form.expiry,
          cvv: form.cvv,
          cardholder_name: form.name,
        },
      };

      // Call backend API
      const result = await createOrder(orderData);

      if (!result.ok) {
        // Handle payment decline or other errors
        if (result.isPaymentError) {
          setPaymentError(`Payment declined: ${result.error}`);
        } else {
          setPaymentError(result.error || "Failed to process order");
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Use invoice data from API response
      const order = result.data;
      const apiInvoice = order.invoice;
      
      // Build invoice data from the API invoice payload
      const invoiceData = {
        // Invoice identifiers
        id: apiInvoice?.invoice_number || `INV-${order.id}`,
        orderId: apiInvoice?.order_id || order.id,
        
        // Customer info from API
        name: apiInvoice?.customer_name || purchaserName,
        email: apiInvoice?.customer_email || userEmail || "Not provided",
        address: apiInvoice?.delivery_address || order.delivery_address || form.address,
        
        // Timestamps
        date: apiInvoice?.issue_date 
          ? new Date(apiInvoice.issue_date).toLocaleString() 
          : new Date(order.created_at).toLocaleString(),
        
        // Financial data from API
        total: Number(apiInvoice?.total_amount || order.total_amount),
        subtotal: Number(apiInvoice?.subtotal || order.subtotal),
        tax: Number(apiInvoice?.tax_amount || order.tax_amount),
        
        // Order/Payment status from API
        status: apiInvoice?.order_status || order.status,
        paymentStatus: apiInvoice?.payment_status || order.payment_status,
        transactionId: apiInvoice?.transaction_id || order.transaction_id,
        cardLastFour: apiInvoice?.card_last_four || order.card_last_four,
        
        // Items from API invoice
        items: apiInvoice?.items?.map((it) => ({
          name: it.name,
          qty: it.quantity,
          unitPrice: Number(it.unit_price),
          lineTotal: Number(it.line_total),
          image: it.product_image,
        })) || order.items?.map((it) => ({
          name: it.product_name || `Product #${it.product}`,
          qty: it.quantity,
          unitPrice: Number(it.unit_price),
          lineTotal: Number(it.line_total),
        })) || [],
      };

      setInvoice(invoiceData);
      sendInvoiceEmail(invoiceData);
      clearCart();
    } catch (err) {
      console.error("Checkout error:", err);
      setPaymentError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="checkout-page">
        <header className="checkout-header">
          <Link to="/" className="logo">
            ShopName
          </Link>
          <Link to="/cart" className="link-muted">
            Back to cart
          </Link>
        </header>
        <div className="checkout-guard">
          <h1>Please sign in to checkout</h1>
          <p className="helper">
            You need to be logged in to complete your purchase.
          </p>
          <Link className="pay-btn" to="/login">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <Link to="/" className="logo">
          ShopName
        </Link>
        <Link to="/cart" className="link-muted">
          Back to cart
        </Link>
      </header>

      <div className="checkout-layout">
        <section className="card-form">
          <h1>Checkout</h1>
          <p className="helper">Enter your card details to place the order.</p>

          <form onSubmit={handleSubmit} className="form-grid">
            <label className="form-field">
              <span>Cardholder name</span>
              <input
                type="text"
                value={form.name}
                onChange={updateField("name")}
                placeholder="Jane Doe"
              />
              {errors.name && <small className="error">{errors.name}</small>}
            </label>

            <label className="form-field">
              <span>Shipping address</span>
              <input
                type="text"
                value={form.address}
                onChange={updateField("address")}
                placeholder="Street, City, Country"
              />
              {errors.address && (
                <small className="error">{errors.address}</small>
              )}
            </label>

            <label className="form-field">
              <span>Card number</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.cardNumber}
                onChange={updateField("cardNumber", formatCardNumber)}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
              {errors.cardNumber && (
                <small className="error">{errors.cardNumber}</small>
              )}
            </label>

            <div className="row">
              <label className="form-field">
                <span>Expiry (MM/YY)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.expiry}
                  onChange={updateField("expiry", formatExpiry)}
                  placeholder="08/27"
                  maxLength={5}
                />
                {errors.expiry && (
                  <small className="error">{errors.expiry}</small>
                )}
              </label>

              <label className="form-field">
                <span>CVV</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={form.cvv}
                  onChange={updateField("cvv")}
                  placeholder="123"
                  maxLength={4}
                />
                {errors.cvv && <small className="error">{errors.cvv}</small>}
              </label>
            </div>

            {paymentError && (
              <div className="payment-error">
                <span className="error-icon">⚠</span>
                {paymentError}
              </div>
            )}

            <button 
              type="submit" 
              className="pay-btn" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : `Pay ${totalItems ? `₺${estimatedTotal.toFixed(2)}` : "now"}`}
            </button>

            {invoice && (
              <div className="invoice-box success">
                <div className="payment-success-header">
                  <span className="success-icon">✓</span>
                  <span>Payment Confirmed!</span>
                </div>
                <div className="invoice-head">
                  <div>
                    <div className="muted">Invoice</div>
                    <div className="invoice-id">{invoice.id}</div>
                  </div>
                  <button
                    type="button"
                    className="download-btn"
                    onClick={() => downloadInvoice(invoice)}
                  >
                    Download PDF
                  </button>
                </div>
                
                {/* Customer Info */}
                <div className="invoice-section">
                  <div className="muted">Customer</div>
                  <div className="invoice-customer">{invoice.name}</div>
                  <div className="invoice-email">{invoice.email}</div>
                </div>
                
                {invoice.transactionId && (
                  <div className="invoice-section">
                    <div className="muted">Transaction ID</div>
                    <div className="transaction-id">{invoice.transactionId}</div>
                  </div>
                )}
                {invoice.cardLastFour && (
                  <div className="invoice-section">
                    <div className="muted">Card</div>
                    <div>•••• •••• •••• {invoice.cardLastFour}</div>
                  </div>
                )}
                
                <div className="invoice-status-row">
                  <div>
                    <div className="muted">Order Status</div>
                    <div className="order-status">{invoice.status}</div>
                  </div>
                  <div>
                    <div className="muted">Payment Status</div>
                    <div className="payment-status approved">{invoice.paymentStatus}</div>
                  </div>
                </div>
                
                <div className="invoice-section">
                  <div className="muted">Delivery Address</div>
                  <div>{invoice.address}</div>
                </div>
                
                {/* Invoice Items */}
                {invoice.items && invoice.items.length > 0 && (
                  <div className="invoice-items-section">
                    <div className="muted">Items</div>
                    <div className="invoice-items-list">
                      {invoice.items.map((item, idx) => (
                        <div key={idx} className="invoice-item-row">
                          <div className="invoice-item-info">
                            <span className="invoice-item-name">{item.name}</span>
                            <span className="invoice-item-qty">× {item.qty}</span>
                          </div>
                          <div className="invoice-item-price">
                            ₺{(item.lineTotal || item.qty * item.unitPrice).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Financial Summary */}
                <div className="invoice-financial">
                  {invoice.subtotal && (
                    <div className="invoice-financial-row">
                      <span>Subtotal</span>
                      <span>₺{invoice.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.tax && (
                    <div className="invoice-financial-row">
                      <span>Tax (18%)</span>
                      <span>₺{invoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="invoice-financial-row total">
                    <span>Total</span>
                    <span className="invoice-total">₺{invoice.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="invoice-actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate("/orders")}
                  >
                    View My Orders
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate("/")}
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>

        <aside className="order-summary">
          <h2>Order summary</h2>
          <div className="summary-row">
            <span>Items</span>
            <span>{totalItems}</span>
          </div>
          <div className="summary-row">
            <span>Estimated total</span>
            <span>₺{estimatedTotal.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
