// src/components/AuthLayout.jsx
export default function AuthLayout({ left, right }) {
    return (
      <div
        className="auth-grid"
        style={{
          minHeight: "100vh",
          width: "100%",                       // ← use 100% (not 100vw) to avoid white stripe
          display: "grid",
          gridTemplateColumns: "minmax(340px,520px) 1fr",
        }}
      >
        <div style={{ padding: 32 }}>{left}</div>
  
        <div
          className="auth-right"
          style={{
            background: "#f6f7f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",               // keeps image inside
          }}
        >
          {right}
        </div>
      </div>
    );
  }
  