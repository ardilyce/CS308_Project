import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../lib/api";
import "./ProductManagerPage.css";

// --- MOCK DATA (kept for products/deliveries demo) ---
const MOCK_PRODUCTS = [
  { id: 101, name: "Wireless Headphones", stock: 15, price: 150, category: "Electronics" },
  { id: 102, name: "Running Shoes", stock: 8, price: 85, category: "Clothing" },
  { id: 103, name: "Smart Watch", stock: 0, price: 250, category: "Electronics" },
];

const MOCK_DELIVERIES = [
  { id: "DLV-001", customer: "John Doe", address: "123 Main St, Istanbul", items: "Wireless Headphones (x1)", total: 150, status: "Processing" },
  { id: "DLV-002", customer: "Alice Yilmaz", address: "456 Side Ave, Ankara", items: "Running Shoes (x1)", total: 85, status: "In-Transit" },
];

export default function ProductManagerPage() {
  const [activeTab, setActiveTab] = useState("products"); // 'products', 'deliveries', 'comments'
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [deliveries, setDeliveries] = useState(MOCK_DELIVERIES);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");

  // --- HANDLERS ---

  // 1. Stock Management
  const handleStockChange = (id, newStock) => {
    setProducts(products.map(p => p.id === id ? { ...p, stock: parseInt(newStock, 10) || 0 } : p));
  };

  const handleDeleteProduct = (id) => {
    if (window.confirm("Are you sure you want to remove this product?")) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  // 2. Delivery Management
  const handleStatusUpdate = (id, newStatus) => {
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  // 3. Comment Approval
  useEffect(() => {
    if (activeTab !== "comments") return;
    let cancelled = false;
    const fetchComments = async () => {
      try {
        setCommentsLoading(true);
        setCommentsError("");
        const res = await axios.get(`${API_BASE}/api/reviews/?status=pending`);
        if (!cancelled) {
          const data = res.data;
          const list = Array.isArray(data) ? data : data?.results || [];
          setComments(list);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setCommentsError("Failed to load comments.");
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };
    fetchComments();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleCommentAction = async (id, action) => {
    try {
      if (action === "Approve") {
        await axios.patch(`${API_BASE}/api/reviews/${id}/flag/`, { flag: true });
      } else {
        await axios.delete(`${API_BASE}/api/reviews/${id}/flag/`);
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to update review status");
    }
  };

  return (
    <div className="pm-container">
      <header className="pm-header">
        <h1>Product Manager Dashboard</h1>
        <nav className="pm-nav">
          <button
            className={activeTab === "products" ? "active" : ""}
            onClick={() => setActiveTab("products")}
          >
            Products & Stock
          </button>
          <button
            className={activeTab === "deliveries" ? "active" : ""}
            onClick={() => setActiveTab("deliveries")}
          >
            Deliveries
          </button>
          <button
            className={activeTab === "comments" ? "active" : ""}
            onClick={() => setActiveTab("comments")}
          >
            Comments ({comments.length})
          </button>
        </nav>
      </header>

      <main className="pm-content">
        {/* TAB 1: PRODUCTS */}
        {activeTab === "products" && (
          <div className="tab-section">
            <div className="section-header">
              <h2>Inventory Management</h2>
              <button className="btn-black">+ Add New Product</button>
            </div>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>${p.price}</td>
                    <td>
                      <input
                        type="number"
                        className="stock-input"
                        value={p.stock}
                        onChange={(e) => handleStockChange(p.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <button className="btn-text-danger" onClick={() => handleDeleteProduct(p.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: DELIVERIES */}
        {activeTab === "deliveries" && (
          <div className="tab-section">
            <div className="section-header">
              <h2>Delivery Status</h2>
            </div>
            <div className="delivery-grid">
              {deliveries.map(d => (
                <div key={d.id} className="delivery-card">
                  <div className="card-top">
                    <span className="order-id">{d.id}</span>
                    <span className={`status-badge ${d.status.toLowerCase()}`}>{d.status}</span>
                  </div>
                  <div className="card-details">
                    <p><strong>To:</strong> {d.customer}</p>
                    <p className="address">{d.address}</p>
                    <div className="divider"></div>
                    <p><strong>Items:</strong> {d.items}</p>
                  </div>
                  <div className="card-actions">
                    <select
                      value={d.status}
                      onChange={(e) => handleStatusUpdate(d.id, e.target.value)}
                    >
                      <option value="Processing">Processing</option>
                      <option value="In-Transit">In-Transit</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: COMMENTS */}
        {activeTab === "comments" && (
          <div className="tab-section">
             <div className="section-header">
              <h2>Pending Approvals</h2>
            </div>
            {commentsLoading ? (
              <p className="empty-msg">Loading...</p>
            ) : commentsError ? (
              <p className="empty-msg">{commentsError}</p>
            ) : comments.length === 0 ? (
                <p className="empty-msg">No pending comments to review.</p>
            ) : (
                <div className="comments-list">
                {comments.map(c => (
                    <div key={c.id} className="comment-item">
                    <div className="comment-content">
                        <h4>{c.product_name || c.product} <span className="rating">? {c.rating}</span></h4>
                        <p className="comment-user">by {c.user_name || c.user}</p>
                        <p className="comment-text">"{c.comment}"</p>
                    </div>
                    <div className="comment-actions">
                        <button className="btn-approve" onClick={() => handleCommentAction(c.id, 'Approve')}>Approve</button>
                        <button className="btn-reject" onClick={() => handleCommentAction(c.id, 'Reject')}>Reject</button>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
