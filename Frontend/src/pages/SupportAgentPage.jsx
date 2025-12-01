import React, { useState } from "react";
import "./SupportAgentPage.css";

// Mock Data to simulate the backend response for requirements
const MOCK_QUEUE = [
  { id: 101, customer: "Alice Yilmaz", status: "waiting", lastMsg: "My order hasn't arrived yet.", time: "2m" },
  { id: 102, customer: "John Doe", status: "active", lastMsg: "Can I return this item?", time: "5m" },
];

const MOCK_CHAT_HISTORY = [
  { id: 1, sender: "customer", text: "Hi, I have a question about Order #4490.", time: "10:00 AM" },
  { id: 2, sender: "agent", text: "Hello! I'd be happy to help. Let me pull up your details.", time: "10:01 AM" },
  { id: 3, sender: "customer", text: "It says 'Delivered' but I haven't received it.", time: "10:02 AM" },
];

const MOCK_CUSTOMER_DETAILS = {
  name: "Alice Yilmaz",
  email: "alice@example.com",
  type: "Logged In User",
  // Requirement: View previous orders and delivery status 
  orders: [
    { id: "4490", date: "2025-11-20", status: "Delivered", total: 1250 },
    { id: "4485", date: "2025-10-15", status: "Processing", total: 450 },
  ],
  // Requirement: View wish list items 
  wishlist: ["Wireless Headphones", "Smart Watch Strap"],
  // Requirement: View cart contents [cite: 47]
  cartSummary: "3 items in cart ($120 total)"
};

export default function SupportAgentPage() {
  const [activeTab, setActiveTab] = useState("queue"); // 'queue' or 'my-chats'
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState(MOCK_CHAT_HISTORY);

  // Simulate claiming a chat 
  const handleClaimChat = (chat) => {
    setSelectedChat({ ...chat, status: "active" });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    // Add message to UI
    const newMsg = {
      id: messages.length + 1,
      sender: "agent",
      text: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMsg]);
    setMessageInput("");
  };

  return (
    <div className="agent-dashboard">
      {/* LEFT COLUMN: The Queue  */}
      <aside className="agent-sidebar">
        <div className="sidebar-header">
          <h2>Support Dashboard</h2>
          <div className="tab-switch">
            <button 
                className={activeTab === "queue" ? "active" : ""} 
                onClick={() => setActiveTab("queue")}
            >
                Queue (2)
            </button>
            <button 
                className={activeTab === "my-chats" ? "active" : ""} 
                onClick={() => setActiveTab("my-chats")}
            >
                My Chats
            </button>
          </div>
        </div>

        <div className="chat-list">
          {MOCK_QUEUE.map((chat) => (
            <div 
                key={chat.id} 
                className={`chat-list-item ${selectedChat?.id === chat.id ? "selected" : ""}`}
                onClick={() => handleClaimChat(chat)}
            >
              <div className="avatar-circle">{chat.customer.charAt(0)}</div>
              <div className="chat-preview">
                <div className="chat-preview-top">
                    <span className="customer-name">{chat.customer}</span>
                    <span className="time-ago">{chat.time}</span>
                </div>
                <p className="last-msg">{chat.lastMsg}</p>
                {chat.status === "waiting" && <span className="badge-waiting">Waiting</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER COLUMN: Chat Interface  */}
      <main className="chat-main">
        {selectedChat ? (
          <>
            <header className="chat-header">
              <div className="header-info">
                <h3>{selectedChat.customer}</h3>
                <span className="status-indicator">Active Now</span>
              </div>
              <button className="btn-close-ticket">Close Ticket</button>
            </header>

            <div className="messages-area">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-bubble ${msg.sender}`}>
                  <div className="bubble-content">
                    <p>{msg.text}</p>
                    {/* Placeholder for attachments  */}
                    {msg.attachment && <div className="attachment-preview">📄 {msg.attachment}</div>}
                  </div>
                  <span className="msg-time">{msg.time}</span>
                </div>
              ))}
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
               {/* Attachment Button [cite: 48, 50] */}
              <button type="button" className="btn-icon" title="Attach File">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </button>
              <input 
                type="text" 
                placeholder="Type your reply..." 
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button type="submit" className="btn-send">Send</button>
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

      {/* RIGHT COLUMN: Customer Context  */}
      {selectedChat && (
        <aside className="customer-panel">
          <div className="panel-section user-profile">
            <div className="large-avatar">{MOCK_CUSTOMER_DETAILS.name.charAt(0)}</div>
            <h3>{MOCK_CUSTOMER_DETAILS.name}</h3>
            <p className="user-email">{MOCK_CUSTOMER_DETAILS.email}</p>
            <span className="user-badge">{MOCK_CUSTOMER_DETAILS.type}</span>
          </div>

          <div className="panel-scroll">
            {/* Context: Active Cart [cite: 47] */}
            <div className="panel-section">
                <h4>🛒 Active Cart</h4>
                <div className="info-card warning">
                    {MOCK_CUSTOMER_DETAILS.cartSummary}
                </div>
            </div>

            {/* Context: Recent Orders  */}
            <div className="panel-section">
                <h4>📦 Recent Orders</h4>
                {MOCK_CUSTOMER_DETAILS.orders.map(order => (
                    <div key={order.id} className="info-card">
                        <div className="card-row">
                            <span>Order #{order.id}</span>
                            <span className={`status ${order.status.toLowerCase()}`}>{order.status}</span>
                        </div>
                        <div className="card-row sm">
                            <span>{order.date}</span>
                            <span>${order.total}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Context: Wishlist  */}
            <div className="panel-section">
                <h4>❤️ Wishlist</h4>
                <ul className="simple-list">
                    {MOCK_CUSTOMER_DETAILS.wishlist.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}