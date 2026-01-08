import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { apiUrl } from "../lib/api";
import "./ProfilePage.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(apiUrl("api/users/me/profile/"));
        setProfile(data);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Could not load profile information.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-state">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  // Extract user info safely
  const user = profile?.user || {};
  const userId = user.id || "N/A";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "User";
  const email = user.email || "No email provided";
  const taxId = profile?.tax_id || "No tax ID saved";
  const address = profile?.home_address || "No home address saved";

  return (
    <div className="profile-container">
      <div className="profile-header">My Profile</div>

      {/* User Info Card */}
      <div className="profile-card">
        <div className="profile-section-title">Personal Information</div>
        
        <div className="info-grid">
          <div className="info-group">
            <span className="info-label">User ID</span>
            <span className="info-value">{userId}</span>
          </div>

          <div className="info-group">
            <span className="info-label">Full Name</span>
            <span className="info-value">{fullName}</span>
          </div>

          <div className="info-group">
            <span className="info-label">Email Address</span>
            <span className="info-value">{email}</span>
          </div>

          <div className="info-group">
            <span className="info-label">Tax ID</span>
            <span className="info-value">{taxId}</span>
          </div>

          <div className="info-group" style={{ gridColumn: "1 / -1" }}>
            <span className="info-label">Home Address</span>
            <span className="info-value">{address}</span>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <Link to="/profile/orders" className="action-card">
          <span className="action-icon">🛒</span>
          <span>Purchase History</span>
        </Link>
      </div>
    </div>
  );
}
