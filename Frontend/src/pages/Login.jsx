import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import TextInput from "../components/TextInput.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

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

      // post to backend
      const res = await axios.post(`${API}/auth/login`, form);

      // backend success shape: { ok: true, token, user }
      if (res.data?.ok) {
        const { token } = res.data;
        localStorage.setItem("token", token);
        // optional: set default auth header for next requests
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        nav("/dashboard"); // change to your actual post-login route
      } else {
        // if backend ever returns 200 with ok:false
        setServerMsg(res.data?.error || "login failed");
      }
    } catch (err) {
      // backend error shape: { ok: false, error: "Wrong password" } with 401
      const msg = err.response?.data?.error || err.message || "login failed";
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
          <span style={{ textDecoration: "underline", fontWeight: 500 }}>Login</span>
          <Link to="/signup">Sign up</Link>
        </nav>
      </div>

      <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: "18px 0 8px" }}>Hello!</h1>
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
          <div style={{ marginTop: 10, color: "#b42318", fontSize: 14 }}>{serverMsg}</div>
        ) : null}

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Don’t have an account? <Link to="/signup" style={{ fontWeight: 600 }}>Sign up</Link>
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
        <Link to="/" style={{ color: "#111827", textDecoration: "underline" }}>
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
