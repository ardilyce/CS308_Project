import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./CheckoutPage.css";

const initialState = {
  name: "",
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

  const cartItems = useMemo(() => state?.cartItems || [], [state]);
  const itemCount = cartItems.length;
  const estimatedTotal = itemCount * 99; // placeholder total
  const loggedIn = Boolean(localStorage.getItem("accessToken"));

  const updateField = (key, formatter) => (e) => {
    const value = formatter ? formatter(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Cardholder name is required";

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitted(true);
    setTimeout(() => navigate("/"), 800);
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
              Pay {itemCount ? `$${estimatedTotal}` : "now"}
            </button>

            {submitted && (
              <div className="success-banner">
                Payment submitted. Redirecting you to home...
              </div>
            )}
          </form>
        </section>

        <aside className="order-summary">
          <h2>Order summary</h2>
          <div className="summary-row">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>
          <div className="summary-row">
            <span>Estimated total</span>
            <span>${estimatedTotal.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
