import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../lib/api";
import { getStoredUser } from "../lib/auth";
import "./ProductManagerPage.css";

const statusOptions = ["Processing", "In-Transit", "Delivered"];

// Pagination constants
const PRODUCTS_PER_PAGE = 10;
const DELIVERIES_PER_PAGE = 6;
const COMMENTS_PER_PAGE = 8;

const authHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const deriveDeliveryStatus = (orderStatus, isCompleted) => {
  const normalized = (orderStatus || "").toUpperCase();
  if (isCompleted || normalized === "DELIVERED") return "Delivered";
  if (normalized === "SHIPPED") return "In-Transit";
  return "Processing";
};

const normalizeDelivery = (delivery) => ({
  id: delivery.id,
  orderId: delivery.order,
  customer: delivery.customer_name || `User #${delivery.customer}`,
  address: delivery.delivery_address,
  items: `${delivery.product_name || "Product"} (x${delivery.quantity})`,
  total: Number(delivery.total_price) || 0,
  status: deriveDeliveryStatus(delivery.order_status, delivery.is_completed),
});

const normalizeProduct = (product) => ({
  id: product.id,
  name: product.name,
  stock: product.stock ?? 0,
  price: Number(product.price) || 0,
  category: product.category || product.brand || "Other",
});

export default function ProductManagerPage() {
  const [activeTab, setActiveTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productsTotalCount, setProductsTotalCount] = useState(0);
  const [user, setUser] = useState(() => getStoredUser());

  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState("");

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [dirtyStocks, setDirtyStocks] = useState({});

  // Pagination state
  const [productsPage, setProductsPage] = useState(1);
  const [deliveriesPage, setDeliveriesPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newProduct, setNewProduct] = useState({
    id: "",
    name: "",
    brand: "",
    category: "",
    price: "",
    stock: "",
    model: "",
    serialnumber: "",
    warranty: "",
    description: "",
    image: null,
  });
  const [addLoading, setAddLoading] = useState(false);

  const statusPayloadMap = useMemo(
    () => ({
      Processing: "PROCESSING",
      "In-Transit": "SHIPPED",
      Delivered: "DELIVERED",
    }),
    [],
  );

  // Server-side pagination for products (uses backend pagination)
  const totalProductsPages = Math.ceil(productsTotalCount / PRODUCTS_PER_PAGE) || 1;
  const safeProductsPage = Math.min(productsPage, Math.max(1, totalProductsPages));

  // Client-side pagination for deliveries and comments (loaded all at once)
  const totalDeliveriesPages = Math.ceil(deliveries.length / DELIVERIES_PER_PAGE) || 1;
  const safeDeliveriesPage = Math.min(deliveriesPage, totalDeliveriesPages);
  const paginatedDeliveries = deliveries.slice(
    (safeDeliveriesPage - 1) * DELIVERIES_PER_PAGE,
    safeDeliveriesPage * DELIVERIES_PER_PAGE
  );

  const totalCommentsPages = Math.ceil(comments.length / COMMENTS_PER_PAGE) || 1;
  const safeCommentsPage = Math.min(commentsPage, totalCommentsPages);
  const paginatedComments = comments.slice(
    (safeCommentsPage - 1) * COMMENTS_PER_PAGE,
    safeCommentsPage * COMMENTS_PER_PAGE
  );

  // Generate page numbers with ellipsis for pagination UI
  const getPageNumbers = (currentPage, totalPages) => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Check if user has product_manager role (or is_staff for backwards compatibility)
  const isManager = user?.role === "product_manager" || !!user?.is_staff;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/categories/`);
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCategories(list);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCats();
  }, []);

  const handleOpenAddModal = async () => {
    try {
      // Fetch latest product to get ID
      const res = await axios.get(`${API_BASE}/api/products/`, {
        params: { page_size: 1 },
      });
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.results || [];
      const lastId = list.length > 0 ? list[0].id : 0;

      setNewProduct((prev) => ({
        ...prev,
        id: lastId + 1,
      }));
      setIsAddModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch latest product id", err);
      alert("Error preparing the form. Please try again.");
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setAddLoading(true);

    const formData = new FormData();
    Object.entries(newProduct).forEach(([key, value]) => {
      if (value !== null && value !== "") {
        formData.append(key, value);
      }
    });

    try {
      await axios.post(`${API_BASE}/api/products/`, formData, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Product added successfully!");
      setIsAddModalOpen(false);
      setNewProduct({
        id: "",
        name: "",
        brand: "",
        category: "",
        price: "",
        stock: "",
        model: "",
        serialnumber: "",
        warranty: "",
        description: "",
        image: null,
      });
      // Refresh products if on products tab
      if (activeTab === "products") {
        setProductsPage(1); // Go to first page to see new product (it's ordered by -id)
        // We need to trigger the useEffect for products, which depends on productsPage.
        // If we were already on page 1, we might need to manually trigger.
        if (productsPage === 1) {
          // Force refresh logic or just let the effect handle it if it changes
          // Actually, productsPage change will trigger it. If it was 1, it won't change.
          // Let's add a refresh trigger if needed, or just re-fetch.
          window.location.reload(); // Simple way to ensure everything is fresh
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add product: " + (err.response?.data?.detail || "Unknown error"));
    } finally {
      setAddLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!isManager || activeTab !== "products") return;
    let cancelled = false;

    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        setProductsError("");
        const res = await axios.get(`${API_BASE}/api/products/`, {
          params: {
            page: productsPage,
            page_size: PRODUCTS_PER_PAGE,
          },
        });
        if (cancelled) return;
        const data = res.data;
        // Handle both paginated response {results, count} and plain array
        const list = Array.isArray(data) ? data : data?.results || [];
        const count = data?.count ?? list.length;
        setProducts(list.map(normalizeProduct));
        setProductsTotalCount(count);
      } catch (err) {
        console.error(err);
        if (!cancelled) setProductsError("Failed to load products.");
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isManager, productsPage]);

  useEffect(() => {
    if (!isManager || activeTab !== "deliveries") return;
    let cancelled = false;

    const fetchDeliveries = async () => {
      try {
        setDeliveriesLoading(true);
        setDeliveriesError("");
        const res = await axios.get(`${API_BASE}/api/orders/deliveries/`, {
          headers: authHeaders(),
        });
        if (cancelled) return;
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.results || [];
        setDeliveries(list.map(normalizeDelivery));
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        const message =
          err?.response?.status === 401
            ? "Manager access required. Please log in."
            : "Failed to load deliveries.";
        setDeliveriesError(message);
      } finally {
        if (!cancelled) setDeliveriesLoading(false);
      }
    };

    fetchDeliveries();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isManager]);

  useEffect(() => {
    if (!isManager || activeTab !== "comments") return;
    let cancelled = false;
    const fetchComments = async () => {
      try {
        setCommentsLoading(true);
        setCommentsError("");
        const res = await axios.get(`${API_BASE}/api/reviews/?status=pending`, {
          headers: authHeaders(),
        });
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
  }, [activeTab, isManager]);

  const handleStockChange = (id, newStock) => {
    const value = parseInt(newStock, 10) || 0;

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: value } : p)),
    );

    setDirtyStocks((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to remove this product?"))
      return;

    try {
      await axios.delete(`${API_BASE}/api/products/${id}/`, {
        headers: authHeaders(),
      });

      // başarılıysa UI'dan sil
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to remove product.");
    }
  };

  const handleCommentAction = async (id, action) => {
    try {
      if (action === "Approve") {
        await axios.patch(
          `${API_BASE}/api/reviews/${id}/flag/`,
          { flag: true },
          { headers: authHeaders() },
        );
      } else {
        await axios.delete(`${API_BASE}/api/reviews/${id}/flag/`, {
          headers: authHeaders(),
        });
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to update review status");
    }
  };

  const handleStatusUpdate = async (id, newStatusLabel) => {
    const nextStatus = statusPayloadMap[newStatusLabel];
    if (!nextStatus) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      alert("Please log in as a manager to update delivery status.");
      return;
    }

    try {
      const res = await axios.patch(
        `${API_BASE}/api/orders/deliveries/${id}/status/`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const updated = normalizeDelivery(res.data);
      setDeliveries((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      console.error(err);
      alert("Failed to update delivery status.");
    }
  };

  const handleSaveStockChanges = async () => {
    const payload = {
      stocks: Object.entries(dirtyStocks).map(([id, stock]) => ({
        id: Number(id),
        stock,
      })),
    };

    try {
      await axios.patch(`${API_BASE}/api/products/stock/`, payload, {
        headers: authHeaders(),
      });

      // başarıyla kaydedildi
      setDirtyStocks({});
      alert("Stock levels updated successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to update stock levels");
    }
  };

  return (
    <div className="pm-container">
      {!isManager ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Manager access required</h2>
          <p style={{ color: "#666", marginTop: 12 }}>
            This page is only available to staff accounts. Please log in with a
            manager account to manage inventory and deliveries.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <button className="btn-black" onClick={() => navigate(-1)}>
              Go back
            </button>
            <Link
              to="/login"
              className="btn-black"
              style={{ textDecoration: "none" }}
            >
              Login
            </Link>
          </div>
        </div>
      ) : (
        <>
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
            {activeTab === "products" && (
              <div className="tab-section">
                <div className="section-header">
                  <h2>Inventory Management</h2>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn-black" onClick={handleOpenAddModal}>
                      + Add New Product
                    </button>

                    <button
                      className="btn-black"
                      disabled={Object.keys(dirtyStocks).length === 0}
                      onClick={handleSaveStockChanges}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>

                {productsLoading ? (
                  <p className="empty-msg">Loading...</p>
                ) : productsError ? (
                  <p className="empty-msg">{productsError}</p>
                ) : products.length === 0 ? (
                  <p className="empty-msg">No products found.</p>
                ) : (
                  <>
                    <table className="pm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Price (\u20BA)</th>
                          <th>Stock Level</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id}>
                            <td>#{p.id}</td>
                            <td>{p.name}</td>
                            <td>{p.category}</td>
                            <td>{`\u20BA${p.price}`}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="stock-input"
                                value={p.stock}
                                onChange={(e) =>
                                  handleStockChange(p.id, e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <button
                                className="btn-text-danger"
                                onClick={() => handleDeleteProduct(p.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {productsTotalCount > PRODUCTS_PER_PAGE && (
                      <div className="pagination-controls">
                        <button
                          className="page-btn page-nav"
                          onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                          disabled={safeProductsPage === 1}
                        >
                          ← Previous
                        </button>
                        <div className="page-numbers">
                          {getPageNumbers(safeProductsPage, totalProductsPages).map((pageNum, idx) =>
                            pageNum === "..." ? (
                              <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                            ) : (
                              <button
                                key={pageNum}
                                className={`page-btn page-number ${pageNum === safeProductsPage ? "active" : ""}`}
                                onClick={() => setProductsPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            )
                          )}
                        </div>
                        <button
                          className="page-btn page-nav"
                          onClick={() => setProductsPage((p) => Math.min(totalProductsPages, p + 1))}
                          disabled={safeProductsPage === totalProductsPages}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "deliveries" && (
              <div className="tab-section">
                <div className="section-header">
                  <h2>Delivery Status</h2>
                </div>
                {deliveriesLoading ? (
                  <p className="empty-msg">Loading...</p>
                ) : deliveriesError ? (
                  <p className="empty-msg">{deliveriesError}</p>
                ) : deliveries.length === 0 ? (
                  <p className="empty-msg">No deliveries found.</p>
                ) : (
                  <>
                    <div className="delivery-grid">
                      {paginatedDeliveries.map((d) => (
                        <div key={d.id} className="delivery-card">
                          <div className="card-top">
                            <span className="order-id">Delivery #{d.id}</span>
                            <span
                              className={`status-badge ${d.status
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div className="card-details">
                            <p>
                              <strong>Order:</strong> #{d.orderId}
                            </p>
                            <p>
                              <strong>To:</strong> {d.customer}
                            </p>
                            <p className="address">{d.address}</p>
                            <div className="divider"></div>
                            <p>
                              <strong>Items:</strong> {d.items}
                            </p>
                          </div>
                          <div className="card-actions">
                            <select
                              value={d.status}
                              onChange={(e) =>
                                handleStatusUpdate(d.id, e.target.value)
                              }
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    {deliveries.length > DELIVERIES_PER_PAGE && (
                      <div className="pagination-controls">
                        <button
                          className="page-btn page-nav"
                          onClick={() => setDeliveriesPage((p) => Math.max(1, p - 1))}
                          disabled={safeDeliveriesPage === 1}
                        >
                          ← Previous
                        </button>
                        <div className="page-numbers">
                          {getPageNumbers(safeDeliveriesPage, totalDeliveriesPages).map((pageNum, idx) =>
                            pageNum === "..." ? (
                              <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                            ) : (
                              <button
                                key={pageNum}
                                className={`page-btn page-number ${pageNum === safeDeliveriesPage ? "active" : ""}`}
                                onClick={() => setDeliveriesPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            )
                          )}
                        </div>
                        <button
                          className="page-btn page-nav"
                          onClick={() => setDeliveriesPage((p) => Math.min(totalDeliveriesPages, p + 1))}
                          disabled={safeDeliveriesPage === totalDeliveriesPages}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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
                  <>
                    <div className="comments-list">
                      {paginatedComments.map((c) => (
                        <div key={c.id} className="comment-item">
                          <div className="comment-content">
                            <h4>
                              {c.product_name || c.product}{" "}
                              <span className="rating">? {c.rating}</span>
                            </h4>
                            <p className="comment-user">
                              by {c.user_name || c.user}
                            </p>
                            <p className="comment-text">"{c.comment}"</p>
                          </div>
                          <div className="comment-actions">
                            <button
                              className="btn-approve"
                              onClick={() => handleCommentAction(c.id, "Approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handleCommentAction(c.id, "Reject")}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {comments.length > COMMENTS_PER_PAGE && (
                      <div className="pagination-controls">
                        <button
                          className="page-btn page-nav"
                          onClick={() => setCommentsPage((p) => Math.max(1, p - 1))}
                          disabled={safeCommentsPage === 1}
                        >
                          ← Previous
                        </button>
                        <div className="page-numbers">
                          {getPageNumbers(safeCommentsPage, totalCommentsPages).map((pageNum, idx) =>
                            pageNum === "..." ? (
                              <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                            ) : (
                              <button
                                key={pageNum}
                                className={`page-btn page-number ${pageNum === safeCommentsPage ? "active" : ""}`}
                                onClick={() => setCommentsPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            )
                          )}
                        </div>
                        <button
                          className="page-btn page-nav"
                          onClick={() => setCommentsPage((p) => Math.min(totalCommentsPages, p + 1))}
                          disabled={safeCommentsPage === totalCommentsPages}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Product</h3>
              <button
                className="close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="add-product-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>ID (Autofilled)</label>
                  <input type="text" value={`#${newProduct.id}`} disabled />
                </div>
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    required
                    value={newProduct.brand}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, brand: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    required
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, category: e.target.value })
                    }
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Price (₺)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, price: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Stock Level</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProduct.stock}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, stock: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input
                    type="text"
                    value={newProduct.model}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, model: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Serial No</label>
                  <input
                    type="text"
                    value={newProduct.serialnumber}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        serialnumber: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Warranty</label>
                  <input
                    type="text"
                    required
                    value={newProduct.warranty}
                    placeholder="e.g. 2 Years"
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, warranty: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Product Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, image: e.target.files[0] })
                    }
                  />
                </div>
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="3"
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      description: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-black"
                  disabled={addLoading}
                >
                  {addLoading ? "Adding..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
