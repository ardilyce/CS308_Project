import { Link } from "react-router-dom";

export default function ProfilePage() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>My Profile</h2>

      <ul style={{ marginTop: "20px" }}>
        <li><Link to="/profile/orders">🛒 Purchase History</Link></li>
        <li><Link to="/favorites">❤️ Favorites</Link></li>
        <li><Link to="/settings">⚙️ Account Settings (future)</Link></li>
      </ul>
    </div>
  );
}