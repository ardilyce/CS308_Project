import { useState } from "react";

/* simple input with label + error text */
export default function TextInput({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  error,
  withToggle = false,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = withToggle && isPassword ? (visible ? "text" : "password") : type;

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d0d5dd",
            outline: "none",
          }}
        />
        {withToggle && isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              top: "50%",
              right: 10,
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
              color: "#6b7280",
            }}
          >
            {visible ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {error ? (
        <div style={{ color: "#b42318", fontSize: 12, marginTop: 6 }}>{error}</div>
      ) : null}
    </div>
  );
}
