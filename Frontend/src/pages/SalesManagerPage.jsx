import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SalesManagerPage.css";
import { getStoredUser } from "../lib/auth";
import axios from "axios";
import { API_BASE } from "../lib/api";

const formatCurrency = (value) => `$${value.toFixed(2)}`;
const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};

const mapRefund = (refund) => {
  const firstItem = refund.items?.[0];
  const status = (refund.status || "").toLowerCase();
  return {
    id: refund.id,
    orderId: refund.order,
    customer: refund.customer_name ?? `User #${refund.customer}`,
    productId: firstItem?.product_id,
    product: firstItem?.product_name ?? `Order #${refund.order}`,
    purchasePrice: Number(firstItem?.line_total_at_purchase ?? 0),
    campaign: refund.reason || "Refund request",
    purchaseDate: refund.created_at?.slice(0, 10),
    returned: status === "received" || status === "refunded",
    refundMethod: "credit_card",
    status,
  };
};

// Pagination constants
const PRODUCTS_PER_PAGE = 10;
const INVOICES_PER_PAGE = 8;
const REFUNDS_PER_PAGE = 5;

export default function SalesManagerPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productsTotalCount, setProductsTotalCount] = useState(0);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [discountRate, setDiscountRate] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceRange, setInvoiceRange] = useState({
    start: "2025-10-01",
    end: "2025-12-28",
  });
  const [financeRange, setFinanceRange] = useState({
    start: "2025-01-01",
    end: "2025-02-28",
  });
  const [refunds, setRefunds] = useState([]);
  const [financeReport, setFinanceReport] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    chart: [],
  });
  const [refundLog, setRefundLog] = useState([]);

  // Pagination state
  const [productsPage, setProductsPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    const fetchRefunds = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await axios.get(`${API_BASE}/api/orders/refunds/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const list = res.data.results ?? res.data;
        setRefunds((list || []).map(mapRefund));
      } catch (err) {
        console.error("Failed to fetch refunds", err);
      }
    };

    fetchRefunds();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const res = await axios.get(`${API_BASE}/api/products/`, {
          params: {
            page: productsPage,
            page_size: PRODUCTS_PER_PAGE,
          },
        });
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.results || [];
        const count = data?.count ?? list.length;
        console.log("PRODUCTS FROM BACKEND:", list, "Total:", count);

        const normalized = list.map((p) => ({
          ...p,
          wishlist: p.wishlist ?? [],
          campaign: p.campaign ?? "",
        }));

        setProducts(normalized);
        setProductsTotalCount(count);
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, [productsPage]);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const token = localStorage.getItem("accessToken");

        const res = await axios.get(`${API_BASE}/api/orders/invoices/`, {
          params: {
            start_date: invoiceRange.start || undefined,
            end_date: invoiceRange.end || undefined,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const mapped = (res.data.results ?? res.data).map((o) => ({
          id: o.invoice?.invoice_number ?? `ORD-${o.id}`,
          date: o.created_at,
          customer:
            o.deliveries?.[0]?.customer_name ??
            o.items?.[0]?.product?.seller ??
            "—",
          status: o.status,
          total: Number(o.invoice?.total_amount ?? o.total_amount ?? 0),
        }));

        setInvoices(mapped);
      } catch (err) {
        console.error("Failed to fetch invoices", err);
      }
    };

    fetchInvoices();
  }, [invoiceRange.start, invoiceRange.end]);

  const filteredInvoices = useMemo(() => {
    const start = invoiceRange.start ? new Date(invoiceRange.start) : null;
    const end = invoiceRange.end ? new Date(invoiceRange.end) : null;

    return invoices.filter((inv) => {
      const d = new Date(inv.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [invoiceRange, invoices]);

  // Reset pagination when filters change
  useEffect(() => {
    setInvoicesPage(1);
  }, [invoiceRange]);

  // Server-side pagination for products (uses backend pagination)
  const totalProductsPages =
    Math.ceil(productsTotalCount / PRODUCTS_PER_PAGE) || 1;
  const safeProductsPage = Math.min(
    productsPage,
    Math.max(1, totalProductsPages),
  );

  // Client-side pagination for invoices and refunds
  const totalInvoicesPages =
    Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE) || 1;
  const safeInvoicesPage = Math.min(invoicesPage, totalInvoicesPages);
  const paginatedInvoices = filteredInvoices.slice(
    (safeInvoicesPage - 1) * INVOICES_PER_PAGE,
    safeInvoicesPage * INVOICES_PER_PAGE,
  );

  const totalRefundsPages = Math.ceil(refunds.length / REFUNDS_PER_PAGE) || 1;
  const safeRefundsPage = Math.min(refundsPage, totalRefundsPages);
  const paginatedRefunds = refunds.slice(
    (safeRefundsPage - 1) * REFUNDS_PER_PAGE,
    safeRefundsPage * REFUNDS_PER_PAGE,
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

  useEffect(() => {
    const fetchFinanceReport = async () => {
      if (!financeRange.start || !financeRange.end) return;
      try {
        const token = localStorage.getItem("accessToken");
        const res = await axios.get(
          `${API_BASE}/api/orders/reports/revenue-profit/`,
          {
            params: {
              start_date: financeRange.start,
              end_date: financeRange.end,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = res.data || {};
        setFinanceReport({
          revenue: Number(data.revenue) || 0,
          cost: Number(data.cost) || 0,
          profit: Number(data.profit) || 0,
          chart: Array.isArray(data.chart) ? data.chart : [],
        });
      } catch (err) {
        console.error("Failed to fetch finance report", err);
      }
    };

    fetchFinanceReport();
  }, [financeRange.start, financeRange.end]);

  const chartData = useMemo(() => {
    return financeReport.chart.map((row) => ({
      label: new Date(row.date).toLocaleDateString("en-US", {
        month: "short",
      }),
      value: Number(row.profit) || 0,
    }));
  }, [financeReport]);

  // Check if user has sales_manager role (or is_staff for backwards compatibility)
  const isManager = user?.role === "sales_manager" || !!user?.is_staff;

  if (!isManager) {
    return (
      <div
        className="sales-page"
        style={{
          background: "#fff",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Sales Manager access required</h2>
          <p style={{ color: "#666", marginTop: 12 }}>
            This page is only available to sales manager accounts.
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
      </div>
    );
  }

  const toggleSelected = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  const applyDiscount = async () => {
    if (selectedProducts.length === 0) return;

    const token = localStorage.getItem("accessToken");

    try {
      await axios.patch(
        `${API_BASE}/api/products/apply-discount/`,
        {
          product_ids: selectedProducts,
          discount_percentage: Number(discountRate),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // ürünleri DB'den tekrar çek
      const res = await axios.get(`${API_BASE}/api/products/`, {
        params: {
          page: productsPage,
          page_size: PRODUCTS_PER_PAGE,
        },
      });

      const data = res.data;
      const list = Array.isArray(data) ? data : data?.results || [];
      setProducts(list);

      setSelectedProducts([]);

      setNotifications((prev) =>
        [
          {
            message: `Applied ${discountRate}% discount to ${selectedProducts.length} products.`,
            ts: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ].slice(0, 6),
      );
    } catch (err) {
      console.error(err);
      alert("Discount could not be applied.");
    }
  };
  const resetDiscounts = async () => {
    if (selectedProducts.length === 0) return;

    const token = localStorage.getItem("accessToken");

    try {
      await axios.patch(
        `${API_BASE}/api/products/reset-discounts/`,
        {
          product_ids: selectedProducts,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // ürünleri DB'den tekrar çek
      const res = await axios.get(`${API_BASE}/api/products/`, {
        params: {
          page: productsPage,
          page_size: PRODUCTS_PER_PAGE,
        },
      });

      const data = res.data;
      const list = Array.isArray(data) ? data : data?.results || [];
      setProducts(list);

      setSelectedProducts([]);

      setNotifications((prev) =>
        [
          {
            message: `Reset discounts for ${selectedProducts.length} products.`,
            ts: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ].slice(0, 6),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to reset discounts.");
    }
  };

  const maxChartValue = Math.max(...chartData.map((c) => Math.abs(c.value)), 1);
  const activeDiscounts = products.filter((p) => p.discount).length;

  const handleInvoiceAction = (action) => {
    const message =
      action === "print"
        ? "Prepared invoices for printing."
        : "Generated PDF export for filtered invoices.";
    setNotifications((prev) =>
      [
        {
          message,
          ts: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ].slice(0, 6),
    );
  };

  const updateRefundStatus = async (refundId, status, managerNote = "") => {
    const token = localStorage.getItem("accessToken");
    const res = await axios.post(
      `${API_BASE}/api/orders/refunds/${refundId}/status/`,
      {
        status,
        manager_note: managerNote,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const updated = mapRefund(res.data);
    setRefunds((prev) =>
      prev.map((r) => (r.id === refundId ? updated : r)),
    );
    return updated;
  };

  const markReceived = (id) => {
    updateRefundStatus(id, "RECEIVED").catch((err) => {
      console.error(err);
      alert("Failed to mark refund as received.");
    });
  };

  const handleRefund = (id, decision) => {
    const request = refunds.find((r) => r.id === id);
    if (!request) return;

    const status = decision === "approved" ? "APPROVED" : "REJECTED";
    updateRefundStatus(id, status).catch((err) => {
      console.error(err);
      alert("Failed to update refund status.");
    });

    if (decision === "approved") {
      setRefundLog((prev) => [
        {
          id,
          amount: request.purchasePrice,
          method: request.refundMethod,
          note: `${request.customer} refund approved at ${formatCurrency(request.purchasePrice)}.`,
        },
        ...prev,
      ]);
    }
  };

  return (
    <div className="sales-page">
      <header className="sales-header">
        <div>
          <p className="eyebrow">Sales Manager</p>
          <h1>Pricing, invoicing, revenue, refunds</h1>
          <p className="subtitle">
            Set discounts, notify wish lists, export invoices, measure
            profit/loss, and finalize refunds with stock and payment updates.
          </p>
        </div>
        <div className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">Active discounts</span>
            <strong>{activeDiscounts}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Invoices in view</span>
            <strong>{filteredInvoices.length}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Refund queue</span>
            <strong>{refunds.filter((r) => r.status === "requested").length}</strong>
          </div>
        </div>
      </header>

      <section className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Pricing & campaigns</p>
              <h3>Set discounts and notify wish lists</h3>
            </div>
            <div className="discount-input">
              <label>Discount rate (%)</label>
              <input
                type="number"
                min="0"
                max="90"
                value={discountRate}
                onChange={(e) => setDiscountRate(e.target.value)}
              />

              <button className="btn-primary" onClick={applyDiscount}>
                Apply to selected
              </button>

              <button
                className="btn-danger"
                onClick={resetDiscounts}
                disabled={selectedProducts.length === 0}
              >
                Reset discounts
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Product</th>
                  <th>Current price</th>
                  <th>New price preview</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {productsLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      Loading...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        textAlign: "center",
                        padding: "20px",
                        color: "#6b7280",
                      }}
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const finalPrice =
                      p.discount && p.discount_percentage
                        ? p.price * (1 - p.discount_percentage / 100)
                        : p.price;
                    const preview = Math.max(
                      0,
                      p.price * (1 - (Number(discountRate) || 0) / 100),
                    );
                    return (
                      <tr key={p.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(p.id)}
                            onChange={() => toggleSelected(p.id)}
                          />
                        </td>
                        <td>
                          <div className="cell-title">{p.name}</div>
                          <span className="subtext">{p.campaign}</span>
                        </td>
                        <td>
                          <div>{formatCurrency(finalPrice)}</div>
                          {p.discount && (
                            <span className="pill">
                              -{p.discount_percentage}% live
                            </span>
                          )}
                        </td>
                        <td>{formatCurrency(preview)}</td>
                        <td>{p.stock}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
                {getPageNumbers(safeProductsPage, totalProductsPages).map(
                  (pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        className={`page-btn page-number ${pageNum === safeProductsPage ? "active" : ""}`}
                        onClick={() => setProductsPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ),
                )}
              </div>
              <button
                className="page-btn page-nav"
                onClick={() =>
                  setProductsPage((p) => Math.min(totalProductsPages, p + 1))
                }
                disabled={safeProductsPage === totalProductsPages}
              >
                Next →
              </button>
            </div>
          )}

          <div className="notification-feed">
            <h4>Notifications sent</h4>
            {notifications.length === 0 ? (
              <p className="muted">No wish list notifications yet.</p>
            ) : (
              notifications.map((n, idx) => (
                <div key={idx} className="note">
                  <span>{n.message}</span>
                  <span className="time">{n.ts}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head space-between">
            <div>
              <p className="eyebrow">Invoices</p>
              <h3>View by date, print, or export PDF</h3>
            </div>
            <div className="date-filters">
              <label>
                From
                <input
                  type="date"
                  value={invoiceRange.start}
                  onChange={(e) =>
                    setInvoiceRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={invoiceRange.end}
                  onChange={(e) =>
                    setInvoiceRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="cell-title">{inv.id}</td>
                    <td>{formatDate(inv.date)}</td>
                    <td>{inv.customer}</td>
                    <td>
                      <span className={`pill ${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{formatCurrency(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length > INVOICES_PER_PAGE && (
            <div className="pagination-controls">
              <button
                className="page-btn page-nav"
                onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))}
                disabled={safeInvoicesPage === 1}
              >
                ← Previous
              </button>
              <div className="page-numbers">
                {getPageNumbers(safeInvoicesPage, totalInvoicesPages).map(
                  (pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        className={`page-btn page-number ${pageNum === safeInvoicesPage ? "active" : ""}`}
                        onClick={() => setInvoicesPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ),
                )}
              </div>
              <button
                className="page-btn page-nav"
                onClick={() =>
                  setInvoicesPage((p) => Math.min(totalInvoicesPages, p + 1))
                }
                disabled={safeInvoicesPage === totalInvoicesPages}
              >
                Next →
              </button>
            </div>
          )}

          <div className="actions-row">
            <button
              className="btn-ghost"
              onClick={() => handleInvoiceAction("print")}
            >
              🖨️ Print
            </button>
            <button
              className="btn-primary"
              onClick={() => handleInvoiceAction("pdf")}
            >
              ⬇️ Save as PDF
            </button>
          </div>
        </div>
      </section>

      <section className="panel-grid">
        <div className="panel">
          <div className="panel-head space-between">
            <div>
              <p className="eyebrow">Revenue & profit</p>
              <h3>Calculate between dates and visualize</h3>
            </div>
            <div className="date-filters">
              <label>
                From
                <input
                  type="date"
                  value={financeRange.start}
                  onChange={(e) =>
                    setFinanceRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={financeRange.end}
                  onChange={(e) =>
                    setFinanceRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <span>Revenue</span>
              <strong>{formatCurrency(financeReport.revenue)}</strong>
            </div>
            <div className="stat-card">
              <span>Cost (defaults to 50% if not set)</span>
              <strong>{formatCurrency(financeReport.cost)}</strong>
            </div>
            <div className="stat-card">
              <span>Profit / Loss</span>
              <strong
                className={financeReport.profit >= 0 ? "positive" : "negative"}
              >
                {formatCurrency(financeReport.profit)}
              </strong>
            </div>
          </div>

          <div className="chart">
            {chartData.map((c) => {
              const width = `${(Math.abs(c.value) / maxChartValue) * 100}%`;
              return (
                <div key={c.label} className="chart-row">
                  <span className="chart-label">{c.label}</span>
                  <div
                    className={`chart-bar ${c.value >= 0 ? "positive" : "negative"}`}
                    style={{ width }}
                  >
                    {formatCurrency(c.value)}
                  </div>
                </div>
              );
            })}
            {chartData.length === 0 && (
              <p className="muted">No sales or refunds in this range.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Refund queue</p>
              <h3>Evaluate, restock, notify, and refund</h3>
            </div>
          </div>

          <div className="refund-list">
            {paginatedRefunds.map((req) => (
              <div key={req.id} className="refund-card">
                <div className="refund-top">
                  <div>
                    <p className="eyebrow">{req.id}</p>
                    <h4>{req.product}</h4>
                    <p className="subtext">
                      Purchased {req.purchaseDate} • {req.campaign}
                    </p>
                  </div>
                  <div className="refund-amount">
                    {formatCurrency(req.purchasePrice)}
                  </div>
                </div>
                <div className="refund-details">
                  <span className="pill">
                    Refund to:{" "}
                    {req.refundMethod === "credit_card"
                      ? "Credit Card"
                      : "Account Balance"}
                  </span>
                  <span className="pill">
                    Returned: {req.returned ? "Yes" : "Awaiting product"}
                  </span>
                  <span className="pill">
                    Honor purchase price even if campaign ended
                  </span>
                </div>
                <div className="refund-actions">
                  {req.status === "approved" && (
                    <button
                      className="btn-ghost"
                      onClick={() => markReceived(req.id)}
                    >
                      Mark product received
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    disabled={req.status !== "requested"}
                    onClick={() => handleRefund(req.id, "approved")}
                  >
                    Approve request
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={req.status !== "requested"}
                    onClick={() => handleRefund(req.id, "rejected")}
                  >
                    Reject
                  </button>
                  {req.status && (
                    <span className={`pill status-${req.status}`}>
                      {req.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {refunds.length > REFUNDS_PER_PAGE && (
            <div className="pagination-controls">
              <button
                className="page-btn page-nav"
                onClick={() => setRefundsPage((p) => Math.max(1, p - 1))}
                disabled={safeRefundsPage === 1}
              >
                ← Previous
              </button>
              <div className="page-numbers">
                {getPageNumbers(safeRefundsPage, totalRefundsPages).map(
                  (pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        className={`page-btn page-number ${pageNum === safeRefundsPage ? "active" : ""}`}
                        onClick={() => setRefundsPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ),
                )}
              </div>
              <button
                className="page-btn page-nav"
                onClick={() =>
                  setRefundsPage((p) => Math.min(totalRefundsPages, p + 1))
                }
                disabled={safeRefundsPage === totalRefundsPages}
              >
                Next →
              </button>
            </div>
          )}

          <div className="refund-log">
            <h4>Refund & stock log</h4>
            {refundLog.length === 0 ? (
              <p className="muted">Actions will show here after approvals.</p>
            ) : (
              refundLog.map((item) => (
                <div key={item.id} className="note">
                  <span>{item.note}</span>
                  <span className="time">
                    {item.method === "credit_card" ? "Card" : "Account"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
