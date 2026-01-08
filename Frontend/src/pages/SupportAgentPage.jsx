import React, { useCallback, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SupportAgentPage.css";
import { getStoredUser } from "../lib/auth";
import {
  getAgentQueue,
  getAgentActiveConversations,
  claimConversation,
  closeConversation,
  getMessages,
  getCustomerContext,
  uploadMessageAttachment,
  getSupportAgentOrderDetail,
  getSupportAgentInvoiceHtml,
  getAttachmentDownloadHeaders,
} from "../lib/support";
import { connectChat, sendMessage, disconnectChat } from "../lib/chat";
import { API_BASE, mediaUrl } from "../lib/api";
import axios from "axios";

const paymentStatusLabels = {
  PENDING: "Payment Pending",
  APPROVED: "Paid",
  DECLINED: "Payment Declined",
  REFUNDED: "Refunded",
};

export default function SupportAgentPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [activeConversations, setActiveConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [customerContext, setCustomerContext] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const loadAllData = useCallback(async () => {
    try {
      // Load both queue and active conversations in parallel
      const [queueResult, activeResult] = await Promise.all([
        getAgentQueue(),
        getAgentActiveConversations(),
      ]);

      if (queueResult.ok) {
        const data = queueResult.data.results || queueResult.data;
        setQueue(Array.isArray(data) ? data : []);
      }

      if (activeResult.ok) {
        const data = activeResult.data.results || activeResult.data;
        setActiveConversations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    console.log("Loading messages for conversation:", conversationId);
    const result = await getMessages(conversationId);
    console.log("Get messages result:", result);
    if (result.ok) {
      const data = result.data.results || result.data;
      console.log("Messages data:", data);
      setMessages(Array.isArray(data) ? data : []);
    } else {
      console.error("Failed to load messages:", result.error);
      alert(`Failed to load messages: ${result.error}`);
      // Set empty array if failed to avoid showing stale data
      setMessages([]);
    }
  }, []);

  const loadCustomerContext = useCallback(async (conversationId) => {
    const result = await getCustomerContext(conversationId);
    if (result.ok) {
      setCustomerContext(result.data);
    } else {
      setCustomerContext(null);
    }
  }, []);

  const connectWebSocket = useCallback((conversationId) => {
    disconnectChat();
    connectChat(
      conversationId,
      (messageData) => {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === messageData.id)) {
            return prev;
          }
          return [...prev, messageData];
        });
      },
      (error) => {
        console.error("WebSocket error:", error);
        // Check if error is about closed ticket
        if (error.includes("ticket is closed") || error.includes("This ticket is closed")) {
          // Close the chat in the UI
          setSelectedChat(null);
          setMessages([]);
          setCustomerContext(null);
          loadAllData();
        }
      },
      () => {
        console.log("WebSocket closed");
      },
    );
  }, [loadAllData]);

  useEffect(() => {
    setUser(getStoredUser());
    setInitialLoading(true);
    loadAllData();
    const interval = setInterval(loadAllData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [loadAllData]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      loadCustomerContext(selectedChat.id);
      connectWebSocket(selectedChat.id);
    }
    return () => {
      disconnectChat();
    };
  }, [connectWebSocket, loadCustomerContext, loadMessages, selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleClaimChat(chat) {
    const result = await claimConversation(chat.id);
    if (result.ok) {
      setSelectedChat(result.data);
      await loadAllData(); // Refresh both queue and active chats
    } else {
      alert("Failed to claim conversation: " + result.error);
    }
  }

  async function handleCloseChat() {
    if (!selectedChat) return;
    const result = await closeConversation(selectedChat.id);
    if (result.ok) {
      setSelectedChat(null);
      setMessages([]);
      setCustomerContext(null);
      await loadAllData(); // Refresh both queue and active chats
    } else {
      alert("Failed to close conversation: " + result.error);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageInput.trim() && !fileInputRef.current?.files[0]) return;
    if (!selectedChat) return;

    const file = fileInputRef.current?.files[0];

    if (file) {
      setUploading(true);
      const result = await uploadMessageAttachment(
        selectedChat.id,
        file,
        messageInput
      );
      setUploading(false);
      fileInputRef.current.value = "";

      if (result.ok) {
        setMessages((prev) => {
          // Avoid duplicates (message will also come via WebSocket)
          if (prev.some((m) => m.id === result.data.id)) {
            return prev;
          }
          return [...prev, result.data];
        });
        setMessageInput("");
      } else {
        // Check if error is about closed ticket
        if (result.error && (result.error.includes("ticket is closed") || result.error.includes("This ticket is closed"))) {
          // Close the chat in the UI
          setSelectedChat(null);
          setMessages([]);
          setCustomerContext(null);
          await loadAllData();
        } else {
          alert("Failed to upload file: " + result.error);
        }
      }
    } else if (messageInput.trim()) {
      if (sendMessage(messageInput)) {
        setMessageInput("");
      } else {
        // Fallback to REST API
        const result = await uploadMessageAttachment(
          selectedChat.id,
          null,
          messageInput
        );
        if (result.ok) {
          setMessages((prev) => {
            // Avoid duplicates (message will also come via WebSocket)
            if (prev.some((m) => m.id === result.data.id)) {
              return prev;
            }
            return [...prev, result.data];
          });
          setMessageInput("");
        } else {
          // Check if error is about closed ticket
          if (result.error && (result.error.includes("ticket is closed") || result.error.includes("This ticket is closed"))) {
            // Close the chat in the UI
            setSelectedChat(null);
            setMessages([]);
            setCustomerContext(null);
            await loadAllData();
          }
        }
      }
    }
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function formatTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  function getCustomerName(chat) {
    if (chat.customer) {
      return chat.customer_name || chat.customer_username || "Customer";
    }
    return chat.guest_name || "Guest";
  }

  function getCustomerEmail(chat) {
    if (chat.customer) {
      return chat.customer_email || "";
    }
    return chat.guest_email || "";
  }

  async function handleOrderClick(orderId) {
    setOrderDetailLoading(true);
    setSelectedOrder(orderId);
    const result = await getSupportAgentOrderDetail(orderId);
    if (result.ok) {
      setOrderDetail(result.data);
    } else {
      alert("Failed to load order details: " + result.error);
      setSelectedOrder(null);
    }
    setOrderDetailLoading(false);
  }

  function closeOrderModal() {
    setSelectedOrder(null);
    setOrderDetail(null);
    setShowInvoice(false);
    setInvoiceHtml(null);
  }

  async function handleInvoiceClick(orderId) {
    setInvoiceLoading(true);
    setShowInvoice(true);
    const result = await getSupportAgentInvoiceHtml(orderId);
    if (result.ok) {
      setInvoiceHtml(result.data.html);
    } else {
      alert("Failed to load invoice: " + result.error);
      setShowInvoice(false);
    }
    setInvoiceLoading(false);
  }

  const isAgent = user?.role === "support_agent" || !!user?.is_staff;
  const conversations = activeTab === "queue" ? queue : activeConversations;

  if (!isAgent) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: '"Inter", system-ui, sans-serif',
          color: "#111",
        }}
      >
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Support Agent access required</h2>
          <p style={{ color: "#666", marginTop: 12 }}>
            This page is only available to support agent accounts.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <button
              className="btn-send"
              style={{ padding: "10px 24px" }}
              onClick={() => navigate(-1)}
            >
              Go back
            </button>
            <Link
              to="/login"
              className="btn-send"
              style={{
                padding: "10px 24px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-dashboard">
      {/* LEFT COLUMN: The Queue */}
      <aside className="agent-sidebar">
        <div className="sidebar-header">
          <h2>Support Dashboard</h2>
          <div className="tab-switch">
            <button
              className={activeTab === "queue" ? "active" : ""}
              onClick={() => setActiveTab("queue")}
            >
              Queue ({queue.length})
            </button>
            <button
              className={activeTab === "my-chats" ? "active" : ""}
              onClick={() => setActiveTab("my-chats")}
            >
              My Chats ({activeConversations.length})
            </button>
          </div>
        </div>

        <div className="chat-list">
          {initialLoading && conversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
              No conversations
            </div>
          ) : (
            conversations.map((chat) => {
              const customerName = getCustomerName(chat);
              const lastMsg = chat.last_message;
              const timeAgo = chat.updated_at
                ? formatTime(chat.updated_at)
                : "";

              return (
                <div
                  key={chat.id}
                  className={`chat-list-item ${
                    selectedChat?.id === chat.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    if (chat.status === "queued") {
                      handleClaimChat(chat);
                    } else {
                      setSelectedChat(chat);
                    }
                  }}
                >
                  <div className="avatar-circle">
                    {customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-preview">
                    <div className="chat-preview-top">
                      <span className="customer-name">{customerName}</span>
                      <span className="time-ago">{timeAgo}</span>
                    </div>
                    <p className="last-msg">
                      {lastMsg?.text
                        ? lastMsg.text.substring(0, 50) + "..."
                        : "No messages"}
                    </p>
                    {chat.status === "queued" && (
                      <span className="badge-waiting">Waiting</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* CENTER COLUMN: Chat Interface */}
      <main className="chat-main">
        {selectedChat ? (
          <>
            <header className="chat-header">
              <div className="header-info">
                <h3>{getCustomerName(selectedChat)}</h3>
              </div>
              <button
                className="btn-close-ticket"
                onClick={handleCloseChat}
              >
                Close Ticket
              </button>
            </header>

            <div className="messages-area">
              {messages.length === 0 ? (
                <div className="empty-chat-state">
                  <div className="empty-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble ${
                      msg.is_from_agent ? "agent" : "customer"
                    }`}
                  >
                    <div className="bubble-content">
                      <p>{msg.text || ""}</p>
                      {msg.attachment_url && (
                        <div className="attachment-preview">
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              try {
                                const headers = getAttachmentDownloadHeaders();
                                
                                // Use axios to download through our backend (handles both Cloudinary and local files)
                                const response = await axios.get(
                                  `${API_BASE}/api/support/messages/${msg.id}/attachment/`,
                                  {
                                    headers,
                                    responseType: "blob",
                                  }
                                );
                                
                                // Handle file download
                                const contentDisposition = response.headers["content-disposition"];
                                let filename = "attachment";
                                if (contentDisposition) {
                                  const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
                                  if (filenameMatch) {
                                    filename = filenameMatch[1];
                                  }
                                }
                                
                                // Create blob and download
                                const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } catch (error) {
                                console.error("Error downloading attachment:", error);
                                if (error.response) {
                                  // Server responded with error
                                  if (error.response.status === 403) {
                                    alert("You don't have permission to download this attachment.");
                                  } else if (error.response.status === 404) {
                                    alert("Attachment not found.");
                                  } else {
                                    const errorMsg = error.response.data?.detail || error.response.statusText;
                                    alert(`Failed to download attachment: ${error.response.status} ${errorMsg}`);
                                  }
                                } else if (error.request) {
                                  // Request made but no response
                                  alert("Failed to connect to server. Please check your connection.");
                                } else {
                                  alert(`Failed to download attachment: ${error.message}`);
                                }
                              }
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            📎 Attachment
                          </a>
                        </div>
                      )}
                    </div>
                    <span className="msg-time">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <button
                type="button"
                className="btn-icon"
                title="Attach File"
                onClick={handleFileSelect}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    handleSendMessage(e);
                  }
                }}
              />
              <input
                type="text"
                placeholder="Type your reply..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={uploading}
              />
              <button
                type="submit"
                className="btn-send"
                disabled={uploading || (!messageInput.trim() && !fileInputRef.current?.files[0])}
              >
                {uploading ? "..." : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat-state">
            <div className="empty-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Pick a customer from the queue to start assisting them.</p>
          </div>
        )}
      </main>

      {/* RIGHT COLUMN: Customer Context */}
      {selectedChat && (
        <aside className="customer-panel">
          <div className="panel-section user-profile">
            <div className="large-avatar">
              {getCustomerName(selectedChat).charAt(0).toUpperCase()}
            </div>
            <h3>{getCustomerName(selectedChat)}</h3>
            <p className="user-email">{getCustomerEmail(selectedChat)}</p>
            <span className="user-badge">
              {selectedChat.customer ? "Logged In User" : "Guest"}
            </span>
          </div>

          <div className="panel-scroll">
            {customerContext && (
              <>
                {/* Active Cart */}
                {customerContext.cart_items &&
                  customerContext.cart_items.length > 0 && (
                    <div className="panel-section">
                      <h4>🛒 Active Cart</h4>
                      <ul className="simple-list">
                        {customerContext.cart_items.map((item) => (
                          <li key={item.id}>
                            <a href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer">
                              {item.product_name} (Qty: {item.quantity}) - TL {(item.product_price * item.quantity).toFixed(2)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Recent Orders */}
                {customerContext.orders &&
                  customerContext.orders.length > 0 && (
                    <div className="panel-section">
                      <h4>📦 Recent Orders</h4>
                      {customerContext.orders.map((order) => (
                        <div 
                          key={order.id} 
                          className="info-card clickable-order"
                          onClick={() => handleOrderClick(order.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="card-row">
                            <span>Order #{order.id}</span>
                            <span className={`status ${order.status.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="card-row sm">
                            <span>{formatDate(order.created_at)}</span>
                            <span>TL {order.total_amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Wishlist */}
                {customerContext.wishlist &&
                  customerContext.wishlist.length > 0 && (
                    <div className="panel-section">
                      <h4>❤️ Wishlist</h4>
                      <ul className="simple-list">
                        {customerContext.wishlist.map((item) => (
                          <li key={item.id}>
                            <a href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer">{item.name}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </>
            )}
            {customerContext &&
              (!customerContext.cart_items ||
                customerContext.cart_items.length === 0) &&
              (!customerContext.orders ||
                customerContext.orders.length === 0) &&
              (!customerContext.wishlist ||
                customerContext.wishlist.length === 0) && (
                <div className="panel-section">
                  <p style={{ color: "#999", fontSize: "13px" }}>
                    No customer context available
                  </p>
                </div>
              )}
          </div>
        </aside>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="order-modal-overlay" onClick={closeOrderModal}>
          <div className="order-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>Order #{selectedOrder}</h2>
              <button className="order-modal-close" onClick={closeOrderModal}>×</button>
            </div>
            <div className="order-modal-body">
              {orderDetailLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                  Loading order details...
                </div>
              ) : orderDetail ? (
                <div>
                  {/* Order Header */}
                  <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div>
                        <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
                          {new Date(orderDetail.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor: orderDetail.status === "PROCESSING" ? "#cce5ff" :
                                          orderDetail.status === "DELIVERED" ? "#c3e6cb" :
                                          orderDetail.status === "CANCELLED" ? "#f8d7da" : "#fff3cd",
                          color: orderDetail.status === "PROCESSING" ? "#004085" :
                                 orderDetail.status === "DELIVERED" ? "#155724" :
                                 orderDetail.status === "CANCELLED" ? "#721c24" : "#856404",
                        }}
                      >
                        {orderDetail.status}
                      </span>
                    </div>
                  </div>

                  {/* Order Info Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                    <div style={{ padding: "15px", background: "#f9f9f9", borderRadius: "6px" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#666" }}>💳 Payment</h4>
                      <p style={{ margin: "0", fontSize: "14px" }}>
                        Status: <strong>{paymentStatusLabels[orderDetail.payment_status] || orderDetail.payment_status}</strong>
                      </p>
                      {orderDetail.card_last_four && (
                        <p style={{ margin: "5px 0 0 0", fontSize: "13px", color: "#666" }}>
                          Card: •••• {orderDetail.card_last_four}
                        </p>
                      )}
                      {orderDetail.transaction_id && (
                        <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#999" }}>
                          Transaction: {orderDetail.transaction_id}
                        </p>
                      )}
                    </div>
                    <div style={{ padding: "15px", background: "#f9f9f9", borderRadius: "6px" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#666" }}>📦 Delivery</h4>
                      <p style={{ margin: "0", fontSize: "13px", color: "#666" }}>
                        {orderDetail.delivery_address}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "600" }}>Order Items</h3>
                    <div style={{ border: "1px solid #eee", borderRadius: "6px", overflow: "hidden" }}>
                      {orderDetail.items?.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            padding: "15px",
                            borderBottom: "1px solid #eee",
                            gap: "15px",
                          }}
                        >
                          <div style={{ width: "60px", height: "60px", background: "#f5f5f5", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {item.product_image ? (
                              <img
                                src={mediaUrl(item.product_image)}
                                alt={item.product_name}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                              />
                            ) : (
                              <span style={{ fontSize: "24px" }}>📦</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: "0 0 5px 0", fontWeight: "500", fontSize: "14px" }}>
                              {item.product_name}
                            </p>
                            <p style={{ margin: "0", fontSize: "13px", color: "#666" }}>
                              Qty: {item.quantity} × TL {parseFloat(item.unit_price).toFixed(2)}
                            </p>
                            {item.is_cancelled && (
                              <span style={{ fontSize: "11px", color: "#721c24", background: "#f8d7da", padding: "2px 6px", borderRadius: "3px", display: "inline-block", marginTop: "5px" }}>
                                Cancelled
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: "0", fontWeight: "600", fontSize: "14px" }}>
                              TL {parseFloat(item.line_total).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Totals */}
                  <div style={{ borderTop: "2px solid #eee", paddingTop: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "600" }}>
                      <span>Total</span>
                      <span>TL {parseFloat(orderDetail.subtotal).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Invoice Info */}
                  {orderDetail.invoice && (
                    <div 
                      style={{ 
                        marginTop: "20px", 
                        padding: "15px", 
                        background: "#f9f9f9", 
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                      onClick={() => handleInvoiceClick(selectedOrder)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f0f0f0"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#f9f9f9"}
                    >
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#666" }}>📄 Invoice (Click to view)</h4>
                      <p style={{ margin: "0", fontSize: "14px" }}>
                        Invoice #: <strong>{orderDetail.invoice.invoice_number}</strong>
                      </p>
                      <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#999" }}>
                        Issued: {new Date(orderDetail.invoice.issue_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  Failed to load order details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && (
        <div className="order-modal-overlay" onClick={() => { setShowInvoice(false); setInvoiceHtml(null); }}>
          <div className="invoice-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>Invoice</h2>
              <button className="order-modal-close" onClick={() => { setShowInvoice(false); setInvoiceHtml(null); }}>×</button>
            </div>
            <div className="invoice-modal-body">
              {invoiceLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                  Loading invoice...
                </div>
              ) : invoiceHtml ? (
                <div dangerouslySetInnerHTML={{ __html: invoiceHtml }} />
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  Failed to load invoice
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
