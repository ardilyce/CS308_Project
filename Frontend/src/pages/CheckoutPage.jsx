import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./CheckoutPage.css";
import { getStoredUser } from "../lib/auth";

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
  const [submitted, setSubmitted] = useState(false);
  const [invoice, setInvoice] = useState(null);

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
          ).toFixed(2)}</td><td>₺${(it.qty * it.unitPrice).toFixed(2)}</td></tr>`,
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${data.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 4px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Invoice</h1>
          <div><b>Invoice ID:</b> ${data.id}</div>
          <div><b>Name:</b> ${data.name}</div>
          <div><b>Email:</b> ${data.email}</div>
          <div><b>Address:</b> ${data.address}</div>
          <div><b>Date:</b> ${data.date}</div>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <h2>Total: ₺${data.total.toFixed(2)}</h2>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    const invoiceData = {
      id: `INV-${Date.now()}`,
      name: purchaserName,
      email: userEmail || "Not provided",
      address: form.address || userAddress || "Not provided",
      date: new Date().toLocaleString(),
      total: estimatedTotal,
      items: cartItems.map((it) => ({
        name: it?.product?.name || `Product #${it.id}`,
        qty: it.qty || 1,
        unitPrice: it?.product?.price ? Number(it.product.price) : 99,
      })),
    };
    setInvoice(invoiceData);
    setSubmitted(true);
    sendInvoiceEmail(invoiceData);
    clearCart();
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

            <button type="submit" className="pay-btn">
              Pay {totalItems ? `₺${estimatedTotal.toFixed(2)}` : "now"}
            </button>

            {invoice && (
              <div className="invoice-box">
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
                <div className="muted">Address</div>
                <div>{invoice.address}</div>
                <div className="muted">Email</div>
                <div>{invoice.email}</div>
                <div className="muted">Total</div>
                <div className="invoice-total">₺{invoice.total.toFixed(2)}</div>
                <button
                  type="button"
                  className="link-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => navigate("/")}
                >
                  Back to home
                </button>
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
