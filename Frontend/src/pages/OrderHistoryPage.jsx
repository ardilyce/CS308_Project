import { Link } from "react-router-dom";
import { mockOrders } from "../lib/mockOrders.js";

export default function OrderHistoryPage() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>My Orders</h2>

      {mockOrders.length === 0 && <p>You have no orders yet.</p>}

      <ul style={{ marginTop: "20px" }}>
        {mockOrders.map(order => (
          <li key={order.id} style={{ marginBottom: "15px" }}>
            <Link to={`/profile/orders/${order.id}`}>
              🧾 Order #{order.id} — <strong>{order.status}</strong> — {order.total}₺
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}