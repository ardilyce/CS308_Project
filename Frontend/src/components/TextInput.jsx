/* simple input with label + error text */
export default function TextInput({
    label,
    type = "text",
    name,
    value,
    onChange,
    placeholder,
    error,
  }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
          {label}
        </label>
        <input
          type={type}
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
        {error ? (
          <div style={{ color: "#b42318", fontSize: 12, marginTop: 6 }}>{error}</div>
        ) : null}
      </div>
    );
  }
  