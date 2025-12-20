import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SalesManagerPage.css";
import { SALES_LEDGER, REFUND_REQUESTS } from "../lib/salesManagerMocks";
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
  const [refunds, setRefunds] = useState(REFUND_REQUESTS);
  const [refundLog, setRefundLog] = useState([]);

  // Pagination state
  const [productsPage, setProductsPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);

  useEffect(() => {
    setUser(getStoredUser());
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const mapped = (res.data.results ?? res.data).map((o) => ({
          id: o.invoice?.invoice_number ?? `ORD-${o.id}`,
          date: o.invoice?.issue_date ?? o.created_at,
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
  }, []);

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

  const filteredLedger = useMemo(() => {
    const start = financeRange.start ? new Date(financeRange.start) : null;
    const end = financeRange.end ? new Date(financeRange.end) : null;
    return SALES_LEDGER.filter((row) => {
      const d = new Date(row.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [financeRange]);

  const financeSummary = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    filteredLedger.forEach((row) => {
      const product = products.find((p) => p.id === row.productId);
      const salePrice = row.salePrice;
      const unitCost = row.cost ?? product?.cost ?? (product?.price || 0) * 0.5;
      revenue += salePrice * row.qty;
      cost += unitCost * row.qty;
    });
    const profit = revenue - cost;
    return { revenue, cost, profit };
  }, [filteredLedger, products]);

  const chartData = useMemo(() => {
    const buckets = {};
    filteredLedger.forEach((row) => {
      const label = new Date(row.date).toLocaleDateString("en-US", {
        month: "short",
      });
      const product = products.find((p) => p.id === row.productId);
      const unitCost = row.cost ?? product?.cost ?? (product?.price || 0) * 0.5;
      const profit = (row.salePrice - unitCost) * row.qty;
      buckets[label] = (buckets[label] || 0) + profit;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [filteredLedger, products]);

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

  const applyDiscount = () => {
    if (selectedProducts.length === 0) return;
    const rate = Number(discountRate) || 0;
    const updates = [];

    setProducts((prev) =>
      prev.map((p) => {
        if (!selectedProducts.includes(p.id)) return p;
        const newPrice = Math.max(0, p.price * (1 - rate / 100));
        updates.push({
          product: p.name,
          oldPrice: p.price,
          newPrice,
          wishlist: p.wishlist,
        });
        return {
          ...p,
          discountedPrice: parseFloat(newPrice.toFixed(2)),
          appliedDiscount: rate,
        };
      }),
    );

    const wishlistPings = updates
      .filter((u) => u.wishlist.length > 0)
      .map((u) => ({
        message: `Notified ${u.wishlist.join(", ")} about ${u.product} now at ${formatCurrency(u.newPrice)}`,
        ts: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

    if (wishlistPings.length > 0) {
      setNotifications((prev) => [...wishlistPings, ...prev].slice(0, 6));
    }
  };

  const maxChartValue = Math.max(...chartData.map((c) => Math.abs(c.value)), 1);
  const activeDiscounts = products.filter(
    (p) => p.discountedPrice && p.discountedPrice < p.price,
  ).length;

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

  const markReceived = (id) => {
    setRefunds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, returned: true } : r)),
    );
  };

  const handleRefund = (id, decision) => {
    setRefunds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: decision } : r)),
    );

    const request = refunds.find((r) => r.id === id);
    if (!request) return;

    if (decision === "approved") {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === request.productId ? { ...p, stock: p.stock + 1 } : p,
        ),
      );

      setRefundLog((prev) => [
        {
          id,
          amount: request.purchasePrice,
          method: request.refundMethod,
          note: `${request.customer} refunded ${formatCurrency(request.purchasePrice)} (campaign price honored). Stock replenished.`,
        },
        ...prev,
      ]);

      setNotifications((prev) =>
        [
          {
            message: `Sent refund approval email to ${request.customer} for ${formatCurrency(request.purchasePrice)}.`,
            ts: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ].slice(0, 6),
      );
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
            <strong>{refunds.filter((r) => !r.status).length}</strong>
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
                    const finalPrice = p.discountedPrice ?? p.price;
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
                          {p.appliedDiscount && (
                            <span className="pill">
                              -{p.appliedDiscount}% live
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
              <strong>{formatCurrency(financeSummary.revenue)}</strong>
            </div>
            <div className="stat-card">
              <span>Cost (defaults to 50% if not set)</span>
              <strong>{formatCurrency(financeSummary.cost)}</strong>
            </div>
            <div className="stat-card">
              <span>Profit / Loss</span>
              <strong
                className={financeSummary.profit >= 0 ? "positive" : "negative"}
              >
                {formatCurrency(financeSummary.profit)}
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
                  {!req.returned && (
                    <button
                      className="btn-ghost"
                      onClick={() => markReceived(req.id)}
                    >
                      ✅ Mark product received
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    disabled={!req.returned}
                    onClick={() => handleRefund(req.id, "approved")}
                  >
                    Approve & restock
                  </button>
                  <button
                    className="btn-ghost"
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
