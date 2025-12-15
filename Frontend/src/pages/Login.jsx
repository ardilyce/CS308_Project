import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import TextInput from "../components/TextInput.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import { persistTokens, persistUser } from "../lib/auth";
import { mergeGuestCart } from "../lib/cart";

const API = "http://localhost:8000";

function extractError(err, fallback = "login failed") {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.detail) return err.response.data.detail;
  const data = err?.response?.data;
  if (data && typeof data === "object") {
    const first = Object.keys(data)[0];
    const value = first ? data[first] : null;
    if (Array.isArray(value) && value.length) return value[0];
    if (value && typeof value === "string") return value;
  }
  return err?.message || fallback;
}

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverMsg, setServerMsg] = useState("");
  const [cartWarnings, setCartWarnings] = useState([]);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validate() {
    const e = {};
    if (!form.email) e.email = "email is required";
    if (!form.password) e.password = "password is required";
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const eobj = validate();
    setErrors(eobj);
    if (Object.keys(eobj).length) return;

    try {
      setBusy(true);
      setServerMsg("");

      const payload = {
        username: form.email.trim().toLowerCase(),
        password: form.password,
      };

      const res = await axios.post(`${API}/api/auth/token/`, payload);
      const { access, refresh } = res.data || {};

      if (!access || !refresh) {
        throw new Error("Auth server did not return access/refresh tokens");
      }

      persistTokens({ access, refresh });

      // Load user profile
      let userRole = "customer";
      try {
        const profile = await axios.get(`${API}/api/auth/me/`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        persistUser(profile.data);
        userRole = profile?.data?.role || "customer";
      } catch (profileErr) {
        console.warn("Failed to load current user", profileErr);
      }

      // Merge guest cart with user's existing cart
      const mergeResult = await mergeGuestCart(access);

      // Redirect based on user role
      const roleDestinations = {
        product_manager: "/product-manager",
        sales_manager: "/sales-manager",
        support_agent: "/support-agent",
        customer: "/",
      };
      const destination = roleDestinations[userRole] || "/";

      // If there are cart warnings, show them briefly before navigating
      if (mergeResult.warnings && mergeResult.warnings.length > 0) {
        setCartWarnings(mergeResult.warnings);
        // Navigate after a short delay so user can see the warnings
        setTimeout(() => nav(destination), 2500);
      } else {
        nav(destination);
      }
    } catch (err) {
      const msg = extractError(err);
      setServerMsg(msg);
    } finally {
      setBusy(false);
    }
  }

  // left column (form)
  const left = (
    <div style={{ maxWidth: 520, margin: "40px auto 0" }}>
      <div style={{ marginBottom: 16 }}>
        <nav style={{ display: "flex", gap: 20, fontSize: 16 }}>
          <span style={{ textDecoration: "underline", fontWeight: 500 }}>
            Login
          </span>
          <Link to="/signup">Sign up</Link>
        </nav>
      </div>

      <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: "18px 0 8px" }}>
        Hello!
      </h1>
      <p style={{ fontSize: 22, color: "#475467", marginBottom: 24 }}>
        Welcome to appname
      </p>

      <form onSubmit={onSubmit}>
        <TextInput
          label="email"
          name="email"
          value={form.email}
          onChange={onChange}
          placeholder="name@example.com"
          error={errors.email}
        />
        <TextInput
          label="password"
          type="password"
          name="password"
          value={form.password}
          onChange={onChange}
          placeholder="your password"
          error={errors.password}
        />

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "#111827",
            color: "white",
            cursor: "pointer",
          }}
        >
          {busy ? "Signing in..." : "Login"}
        </button>

        {serverMsg ? (
          <div style={{ marginTop: 10, color: "#b42318", fontSize: 14 }}>
            {serverMsg}
          </div>
        ) : null}

        {cartWarnings.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "#fef3c7",
              borderRadius: 8,
              border: "1px solid #f59e0b",
            }}
          >
            <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
              Cart updated:
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#78350f", fontSize: 13 }}>
              {cartWarnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
            <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
              Redirecting to home...
            </div>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          <Link
            to="/"
            style={{ color: "#111827", textDecoration: "underline" }}
          >
            Continue without login
          </Link>
        </p>
      </form>
    </div>
  );

  // right column (illustration) – use same/wider image in /public
  const right = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <img
        src="/auth-illustration.png"
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );

  return <AuthLayout left={left} right={right} />;
}
