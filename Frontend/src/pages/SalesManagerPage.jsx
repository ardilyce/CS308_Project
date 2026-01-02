import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const isReturned =
    status === "received" || status === "refunded" || status === "returned";
  return {
    id: refund.id,
    orderId: refund.order,
    customer: refund.customer_name ?? `User #${refund.customer}`,
    productId: firstItem?.product_id,
    product: firstItem?.product_name ?? `Order #${refund.order}`,
    purchasePrice: Number(firstItem?.line_total_at_purchase ?? 0),
    campaign: refund.reason || "Refund request",
    purchaseDate: refund.created_at?.slice(0, 10),
    returned: isReturned,
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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
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
  const [chartTooltip, setChartTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    value: 0,
  });
  const chartWrapperRef = useRef(null);
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
          orderId: o.id,
          invoiceNumber: o.invoice?.invoice_number ?? null,
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
    const end = invoiceRange.end
      ? new Date(new Date(invoiceRange.end).setHours(23, 59, 59, 999))
      : null;

    return invoices.filter((inv) => {
      const d = new Date(inv.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [invoiceRange, invoices]);

  useEffect(() => {
    if (!selectedInvoice) return;
    const exists = invoices.some(
      (inv) => inv.orderId === selectedInvoice.orderId,
    );
    if (!exists) {
      setSelectedInvoice(null);
    }
  }, [invoices, selectedInvoice]);

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

  const fetchFinanceReport = useCallback(async () => {
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
  }, [financeRange.end, financeRange.start]);

  useEffect(() => {
    fetchFinanceReport();
  }, [fetchFinanceReport]);

  const parseLocalDate = (value) => {
    if (!value) return null;
    const parts = value.split("-").map((segment) => Number(segment));
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const chartData = useMemo(() => {
    const start = parseLocalDate(financeRange.start);
    const end = parseLocalDate(financeRange.end);
    if (!start || !end || start > end) return [];

    const byDate = new Map(
      financeReport.chart.map((row) => [row.date, Number(row.profit) || 0]),
    );
    const data = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatDateKey(cursor);
      data.push({
        date: key,
        label: cursor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: byDate.get(key) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return data;
  }, [financeReport.chart, financeRange.end, financeRange.start]);

  // Check if user has sales_manager role (or is_staff for backwards compatibility)
  const isManager = user?.role === "sales_manager" || !!user?.is_staff;

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
  const chartMeta = useMemo(() => {
    if (chartData.length === 0) {
      return {
        width: 640,
        height: 220,
        padding: 28,
        midY: 0,
        path: "",
        points: [],
        labelStep: 1,
      };
    }

    const width = 640;
    const height = 220;
    const padding = 28;
    const midY = padding + (height - padding * 2) / 2;
    const amplitude = (height - padding * 2) / 2;
    const lastIndex = chartData.length - 1;
    const points = chartData.map((point, index) => {
      const x =
        lastIndex === 0
          ? width / 2
          : padding + (index / lastIndex) * (width - padding * 2);
      const y = midY - (point.value / maxChartValue) * amplitude;
      return { ...point, x, y };
    });
    const path = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");
    const labelStep = Math.max(1, Math.ceil(chartData.length / 8));
    return { width, height, padding, midY, path, points, labelStep };
  }, [chartData, maxChartValue]);

  const showChartTooltip = (event, point) => {
    const bounds = chartWrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setChartTooltip({
      visible: true,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      label: point.label,
      value: point.value,
    });
  };

  const hideChartTooltip = () => {
    setChartTooltip((prev) => ({ ...prev, visible: false }));
  };
  const activeDiscounts = products.filter((p) => p.discount).length;

  const handleInvoiceAction = (action) => {
    if (!selectedInvoice) return;

    const mode = action === "print" ? "print" : "download";
    const message =
      mode === "print"
        ? `Opened ${selectedInvoice.id} for printing.`
        : `Downloaded ${selectedInvoice.id} as PDF.`;

    downloadInvoicePdf(selectedInvoice, mode)
      .then(() => {
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
      })
      .catch((err) => {
        console.error("Invoice action failed", err);
        alert("Invoice could not be generated.");
      });
  };

  const downloadInvoicePdf = async (invoice, mode) => {
    const token = localStorage.getItem("accessToken");
    const res = await axios.get(
      `${API_BASE}/api/orders/${invoice.orderId}/invoice-pdf/`,
      {
        params: {
          download: mode === "download" ? "1" : "0",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      },
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const filename = invoice.invoiceNumber
      ? `invoice_${invoice.invoiceNumber}.pdf`
      : `invoice_order_${invoice.orderId}.pdf`;

    if (mode === "download") {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (win) {
        setTimeout(() => {
          win.focus();
          win.print();
        }, 600);
      }
    }

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const updateRefundStatus = async (
    refundId,
    status,
    managerNote = "",
    refundTransactionId = "",
  ) => {
    const token = localStorage.getItem("accessToken");
    const res = await axios.post(
      `${API_BASE}/api/orders/refunds/${refundId}/status/`,
      {
        status,
        manager_note: managerNote,
        refund_transaction_id: refundTransactionId,
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
    fetchFinanceReport();
    return updated;
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

  const markRefunded = (id) => {
    updateRefundStatus(id, "REFUNDED").catch((err) => {
      console.error(err);
      alert("Failed to mark refund as completed.");
    });
  };

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
            <strong>
              {
                refunds.filter((r) =>
                  ["requested", "under_review"].includes(r.status),
                ).length
              }
            </strong>
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
                  <tr
                    key={inv.id}
                    className={`invoice-row ${selectedInvoice?.orderId === inv.orderId ? "selected" : ""}`}
                    onClick={() => setSelectedInvoice(inv)}
                  >
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
              disabled={!selectedInvoice}
            >
              🖨️ Print
            </button>
            <button
              className="btn-primary"
              onClick={() => handleInvoiceAction("pdf")}
              disabled={!selectedInvoice}
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
            {chartData.length > 0 ? (
              <div className="chart-line" ref={chartWrapperRef}>
                <svg
                  className="chart-svg"
                  viewBox={`0 0 ${chartMeta.width} ${chartMeta.height}`}
                  role="img"
                  aria-label="Daily profit line chart"
                >
                  <line
                    className="chart-zero"
                    x1={chartMeta.padding}
                    x2={chartMeta.width - chartMeta.padding}
                    y1={chartMeta.midY}
                    y2={chartMeta.midY}
                  />
                  <path className="chart-path" d={chartMeta.path} />
                  {chartMeta.points.map((point) => (
                    <circle
                      key={point.date}
                      className={`chart-point ${
                        point.value >= 0 ? "positive" : "negative"
                      }`}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      onMouseEnter={(event) => showChartTooltip(event, point)}
                      onMouseMove={(event) => showChartTooltip(event, point)}
                      onMouseLeave={hideChartTooltip}
                    >
                    </circle>
                  ))}
                </svg>
                {chartTooltip.visible && (
                  <div
                    className="chart-tooltip"
                    style={{
                      left: chartTooltip.x,
                      top: chartTooltip.y,
                    }}
                  >
                    <strong>{chartTooltip.label}</strong>
                    <span>{formatCurrency(chartTooltip.value)}</span>
                  </div>
                )}
                <div className="chart-axis">
                  {chartMeta.points.map((point, index) => (
                    <span
                      key={point.date}
                      className={
                        index % chartMeta.labelStep === 0 ||
                        index === chartMeta.points.length - 1
                          ? "chart-axis-label"
                          : "chart-axis-spacer"
                      }
                    >
                      {index % chartMeta.labelStep === 0 ||
                      index === chartMeta.points.length - 1
                        ? point.label
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
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
            {paginatedRefunds.map((req) => {
              const canDecideRefund =
                req.status === "returned" || req.status === "received";
              return (
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
                        onClick={() => markRefunded(req.id)}
                      >
                        Mark refunded
                      </button>
                    )}
                    <button
                      className="btn-primary"
                      disabled={!canDecideRefund}
                      onClick={() => handleRefund(req.id, "approved")}
                    >
                      Approve request
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={!canDecideRefund}
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
              );
            })}
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
