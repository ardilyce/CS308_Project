import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import TextInput from "../components/TextInput.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import { persistTokens, persistUser } from "../lib/auth";
import { mergeGuestCart } from "../lib/cart";

const API = "http://localhost:8000";

function extractError(err, fallback = "sign up failed") {
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

export default function SignUp() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    address: "",
    taxId: "",
    password: "",
    password2: "",
  });

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverMsg, setServerMsg] = useState("");
  const [cartWarnings, setCartWarnings] = useState([]);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "name is required";
    if (!form.email.trim()) e.email = "email is required";
    if (!form.password) e.password = "password is required";
    if (form.password && form.password.length < 6) e.password = "min 6 characters";
    if (form.password2 !== form.password) e.password2 = "passwords don't match";
    return e;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const eobj = validate();
    setErrors(eobj);
    if (Object.keys(eobj).length) return;

    try {
      setBusy(true);
      setServerMsg("");

      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      const res = await axios.post(`${API}/api/auth/signup/`, payload);
      const { ok, tokens, user } = res.data || {};

      if (ok !== true) {
        setServerMsg(res.data?.error || "sign up failed");
        return;
      }

      if (!tokens?.access || !tokens?.refresh) {
        setServerMsg("missing authentication tokens in response");
        return;
      }

      persistTokens(tokens);
      persistUser(user);

      // Merge guest cart and capture any warnings
      const mergeResult = await mergeGuestCart(tokens.access);

      // If there are cart warnings, show them briefly before navigating
      if (mergeResult.warnings && mergeResult.warnings.length > 0) {
        setCartWarnings(mergeResult.warnings);
        // Navigate after a short delay so user can see the warnings
        setTimeout(() => nav("/"), 2500);
      } else {
        nav("/");
      }
    } catch (err) {
      const msg = extractError(err);
      setServerMsg(msg);
    } finally {
      setBusy(false);
    }
  }

  const left = (
    <div style={{ maxWidth: 520, margin: "40px auto 0" }}>
      <div style={{ marginBottom: 16 }}>
        <nav style={{ display: "flex", gap: 20, fontSize: 16 }}>
          <Link to="/login">Login</Link>
          <span style={{ textDecoration: "underline", fontWeight: 500 }}>Sign up</span>
        </nav>
      </div>

      <h1 style={{ fontSize: 36, margin: "18px 0 24px" }}>Create your account</h1>

      <form onSubmit={onSubmit}>
        <TextInput
          label="name and surname"
          name="fullName"
          value={form.fullName}
          onChange={onChange}
          placeholder="Jane Doe"
          error={errors.fullName}
        />
        <TextInput
          label="email"
          name="email"
          value={form.email}
          onChange={onChange}
          placeholder="name@example.com"
          error={errors.email}
        />
        <TextInput
          label="address"
          name="address"
          value={form.address}
          onChange={onChange}
          placeholder="optional"
        />
        <TextInput
          label="taxid"
          name="taxId"
          value={form.taxId}
          onChange={onChange}
          placeholder="optional"
        />
        <TextInput
          label="create password"
          type="password"
          name="password"
          value={form.password}
          onChange={onChange}
          placeholder="********"
          error={errors.password}
        />
        <TextInput
          label="enter password again"
          type="password"
          name="password2"
          value={form.password2}
          onChange={onChange}
          placeholder="********"
          error={errors.password2}
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
          {busy ? "Creating..." : "Sign up"}
        </button>

        {serverMsg ? (
          <div style={{ marginTop: 10, color: "#b42318", fontSize: 14 }}>{serverMsg}</div>
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
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Login</Link>
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          <Link to="/" style={{ color: "#111827", textDecoration: "underline" }}>
            Continue without signing up
          </Link>
        </p>
      </form>
    </div>
  );

  const right = (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f6f7f9",
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
