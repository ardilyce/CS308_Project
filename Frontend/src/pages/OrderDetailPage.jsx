import { useParams } from "react-router-dom";
import { mockOrders } from "../lib/mockOrders.js";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const order = mockOrders.find(o => o.id === orderId);

  if (!order) return <p>Order not found.</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Order #{order.id}</h2>
      <p>Status: <strong>{order.status}</strong></p>
      <p>Total: {order.total}₺</p>
      <p>Delivery Address: {order.deliveryAddress}</p>

      <h3 style={{ marginTop: "20px" }}>Items:</h3>
      <ul>
        {order.items.map((item, index) => (
          <li key={index}>{item.quantity}x {item.name} — {item.price}₺</li>
        ))}
      </ul>
    </div>
  );
}
