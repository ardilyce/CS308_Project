import { Link, useNavigate, useLocation } from "react-router-dom";
import { clearSession, getStoredUser } from "../lib/auth";
import { getCartCount } from "../lib/cart";
import { useEffect, useState } from "react";
import "./NavBar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getCartCount();
      setCartCount(count);
    };

    updateCount();
    
    window.addEventListener("cartUpdated", updateCount);
    return () => window.removeEventListener("cartUpdated", updateCount);
  }, [user]); // re-fetch when user changes

  const handleLogout = () => {
    clearSession();
    setUser(null);
    navigate("/login"); // redirect user to login after logout
  };

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    user?.email ||
    "User";

  // Check if user is a staff role (not a customer)
  const isStaffRole = user?.role && user.role !== "customer";
  
  // Get the dashboard path and label based on role
  const getDashboardInfo = () => {
    switch (user?.role) {
      case "sales_manager":
        return { path: "/sales-manager", label: "Sales Manager Dashboard" };
      case "product_manager":
        return { path: "/product-manager", label: "Product Manager Dashboard" };
      case "support_agent":
        return { path: "/support-agent", label: "Support Agent Dashboard" };
      default:
        return { path: "/profile", label: "Dashboard" };
    }
  };
  
  const dashboardInfo = getDashboardInfo();

  // Show back button only if NOT on home or login/signup
  const hideBackOn = ["/", "/login", "/signup"];
  const showBackButton = !hideBackOn.includes(location.pathname);

  return (
    <nav className="navbar">

      {/* 🔙 Back button */}
      {showBackButton && (
        <button
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ⬅ Back
        </button>
      )}

      {/* 🏪 Logo */}
      <Link to="/" className="logo-link">
        <span className="logo">ShopName</span>
      </Link>

      {/* 🔍 Search */}
      <form
        className="search-wrapper"
        onSubmit={(e) => {
          e.preventDefault();
          const value = e.target.q?.value?.trim() || "";
          if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
        }}
      >
        <input name="q" type="text" placeholder="Search product" className="search-bar" />
        <button type="submit" className="search-btn">Search</button>
      </form>

      {/* 🧭 Icons and Auth */}
      <div className="nav-icons">
        {/* Only show Favorites and Cart for customers (not staff) */}
        {!isStaffRole && (
          <>
            <Link to="/favorites" className="nav-icon">❤️ Favorites</Link>
            <Link to="/cart" className="nav-icon">🛒 Cart ({cartCount})</Link>
          </>
        )}

        {user ? (
          <>
            {isStaffRole ? (
              <Link to={dashboardInfo.path} className="nav-icon">📊 {dashboardInfo.label}</Link>
            ) : (
              <Link to="/profile" className="nav-icon">👤 {displayName}</Link>
            )}
            <button className="nav-icon" onClick={handleLogout}>🚪 Logout</button>
          </>
        ) : (
          <Link to="/login" className="nav-icon">🔑 Login</Link>
        )}
      </div>
    </nav>
  );
}
