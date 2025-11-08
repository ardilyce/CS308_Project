import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import TextInput from "../components/TextInput.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

const API = "http://localhost:8000";

export default function SignUp() {
  const nav = useNavigate();

  // form state
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    address: "",
    taxId: "",
    password: "",
    password2: "",
  });

  // ui state
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  // handlers
  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validate() {
    const e = {};
    if (!form.fullName) e.fullName = "name is required";
    if (!form.email) e.email = "email is required";
    if (!form.password) e.password = "password is required";
    if (form.password && form.password.length < 6) e.password = "min 6 characters";
    if (form.password2 !== form.password) e.password2 = "passwords don’t match";
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
        name: form.fullName,
        email: form.email,
        address: form.address,
        taxId: form.taxId,
        password: form.password,
      };

      // adjust path if your backend is different
      const res = await axios.post(`${API}/api/signup/`, payload);

      // handle both styles: {ok:true} or 201 without ok
      if (res.data?.ok === false) {
        setServerMsg(res.data?.error || "sign up failed");
        return;
      }

      // go to login after success
      nav("/login");
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || "sign up failed navigation to login";
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
          placeholder="••••••••"
          error={errors.password}
        />
        <TextInput
          label="enter password again"
          type="password"
          name="password2"
          value={form.password2}
          onChange={onChange}
          placeholder="••••••••"
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

// right column (illustration)
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
          objectFit: "contain", // no cropping
          display: "block",
        }}
      />
    </div>
  );
  

  return <AuthLayout left={left} right={right} />;
}
