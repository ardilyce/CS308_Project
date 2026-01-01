import React, { useEffect, useState, useRef } from "react";
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
} from "../lib/support";
import { connectChat, sendMessage, disconnectChat } from "../lib/chat";
import { mediaUrl } from "../lib/api";

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
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setUser(getStoredUser());
    setInitialLoading(true);
    loadAllData();
    const interval = setInterval(loadAllData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      loadCustomerContext(selectedChat.id);
      connectWebSocket(selectedChat.id);
    }
    return () => {
      disconnectChat();
    };
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadAllData() {
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
  }

  async function loadMessages(conversationId) {
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
  }

  async function loadCustomerContext(conversationId) {
    const result = await getCustomerContext(conversationId);
    if (result.ok) {
      setCustomerContext(result.data);
    } else {
      setCustomerContext(null);
    }
  }

  function connectWebSocket(conversationId) {
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
      }
    );
  }

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
        setMessages((prev) => [...prev, result.data]);
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
          setMessages((prev) => [...prev, result.data]);
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
                            href={mediaUrl(msg.attachment_url)}
                            target="_blank"
                            rel="noopener noreferrer"
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
                      <div className="info-card warning">
                        {customerContext.cart_items.length} item
                        {customerContext.cart_items.length !== 1 ? "s" : ""} in
                        cart ($
                        {customerContext.cart_items
                          .reduce(
                            (sum, item) =>
                              sum + item.product_price * item.quantity,
                            0
                          )
                          .toFixed(2)}
                        )
                      </div>
                    </div>
                  )}

                {/* Recent Orders */}
                {customerContext.orders &&
                  customerContext.orders.length > 0 && (
                    <div className="panel-section">
                      <h4>📦 Recent Orders</h4>
                      {customerContext.orders.map((order) => (
                        <div key={order.id} className="info-card">
                          <div className="card-row">
                            <span>Order #{order.id}</span>
                            <span className={`status ${order.status.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="card-row sm">
                            <span>{formatDate(order.created_at)}</span>
                            <span>${order.total_amount.toFixed(2)}</span>
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
                          <li key={item.id}>{item.name}</li>
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
    </div>
  );
}
