import React, { useState, useEffect, useRef } from "react";
import { connectChat, sendMessage, disconnectChat } from "../lib/chat";
import { createConversation, getMessages, uploadMessageAttachment } from "../lib/support";
import { getStoredUser } from "../lib/auth";
import "./ChatWidget.css";

// Roles that should NOT see the chat widget (managerial/staff roles)
const EXCLUDED_ROLES = ["product_manager", "sales_manager", "support_agent"];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isClosed, setIsClosed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const user = getStoredUser();

  // Check if user has an excluded role
  const userRole = user?.role || "customer";
  const isExcludedRole = EXCLUDED_ROLES.includes(userRole);

  // Track user changes and reset conversation when user changes
  useEffect(() => {
    const userId = user?.id || null;
    if (currentUserId !== null && currentUserId !== userId) {
      // User has changed (login/logout or different user)
      // Reset conversation state
      disconnectChat();
      setConversationId(null);
      setMessages([]);
      setConnectionStatus("DISCONNECTED");
      setShowGuestForm(false);

      // If user logged out (became guest), clear guest info to show form again
      if (!userId) {
        localStorage.removeItem("chat_guest_name");
        localStorage.removeItem("chat_guest_email");
        localStorage.removeItem("chat_guest_token");
      }
    }
    setCurrentUserId(userId);
  }, [user?.id, currentUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize conversation when widget opens
  useEffect(() => {
    if (isOpen && !conversationId && !isExcludedRole) {
      initializeConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isExcludedRole]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectChat();
    };
  }, []);

  // Don't render the widget for managerial roles (must be after all hooks)
  if (isExcludedRole) {
    return null;
  }

  async function initializeConversation() {
    setIsConnecting(true);
    try {
      // Check if user is logged in or needs guest info
      if (!user) {
        // Check if we already have guest info
        const storedName = localStorage.getItem("chat_guest_name");
        const storedEmail = localStorage.getItem("chat_guest_email");
        if (!storedName || !storedEmail) {
          setShowGuestForm(true);
          setIsConnecting(false);
          return;
        }
        setGuestName(storedName);
        setGuestEmail(storedEmail);
      }

      // Create or get conversation
      const result = await createConversation(
        guestName || user?.name || "",
        guestEmail || user?.email || ""
      );

      if (result.ok) {
        const convId = result.data.id;
        setConversationId(convId);

        // Load existing messages
        const messagesResult = await getMessages(convId);
        if (messagesResult.ok) {
          // Handle both paginated and non-paginated responses
          const data = messagesResult.data?.results || messagesResult.data;
          setMessages(Array.isArray(data) ? data : []);
        }

        // Connect WebSocket
        connectChat(
          convId,
          (messageData) => {
            setMessages((prev) => [...prev, messageData]);
          },
          (error) => {
            console.error("Chat error:", error);
            // Check if error is about closed ticket
            if (error.includes("ticket is closed") || error.includes("This ticket is closed")) {
              setIsClosed(true);
              setErrorMessage(error);
            }
          },
          () => {
            setConnectionStatus("DISCONNECTED");
          }
        );

        setConnectionStatus("CONNECTED");
      } else {
        console.error("Failed to create conversation:", result.error);
      }
    } catch (error) {
      console.error("Failed to initialize conversation:", error);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleGuestSubmit(e) {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) {
      alert("Please provide your name and email");
      return;
    }
    localStorage.setItem("chat_guest_name", guestName);
    localStorage.setItem("chat_guest_email", guestEmail);
    setShowGuestForm(false);
    await initializeConversation();
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!inputText.trim() && !fileInputRef.current?.files[0]) return;

    // Check if conversation is closed
    if (isClosed) {
      return;
    }

    const file = fileInputRef.current?.files[0];

    if (file) {
      // Upload file
      setUploading(true);
      const result = await uploadMessageAttachment(
        conversationId,
        file,
        inputText
      );
      setUploading(false);
      fileInputRef.current.value = "";

      if (result.ok) {
        setMessages((prev) => [...prev, result.data]);
        setInputText("");
      } else {
        // Check if error is about closed ticket
        if (result.error && (result.error.includes("ticket is closed") || result.error.includes("This ticket is closed"))) {
          setIsClosed(true);
          setErrorMessage(result.error);
        } else {
          alert("Failed to upload file: " + result.error);
        }
      }
    } else if (inputText.trim()) {
      // Send text message via WebSocket
      if (sendMessage(inputText)) {
        setInputText("");
      } else {
        // Fallback to REST API if WebSocket fails
        const result = await uploadMessageAttachment(conversationId, null, inputText);
        if (result.ok) {
          setMessages((prev) => [...prev, result.data]);
          setInputText("");
        } else {
          // Check if error is about closed ticket
          if (result.error && (result.error.includes("ticket is closed") || result.error.includes("This ticket is closed"))) {
            setIsClosed(true);
            setErrorMessage(result.error);
          }
        }
      }
    }
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function handleToggle() {
    if (!isOpen) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      disconnectChat();
    }
  }

  function handleNewConversation() {
    disconnectChat();
    setConversationId(null);
    setMessages([]);
    setIsClosed(false);
    setErrorMessage("");
    setConnectionStatus("DISCONNECTED");
    initializeConversation();
  }

  if (!isOpen) {
    return (
      <button className="chat-widget-button" onClick={handleToggle} title="Open chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    );
  }

  return (
    <div className="chat-widget-container">
      <div className="chat-widget-header">
        <h3>Support Chat</h3>
        <button className="chat-widget-close" onClick={handleToggle}>×</button>
      </div>

      <div className="chat-widget-body">
        {showGuestForm ? (
          <div className="chat-guest-form">
            <h4>Welcome! Please provide your details</h4>
            <form onSubmit={handleGuestSubmit}>
              <input
                type="text"
                placeholder="Your Name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Your Email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
              />
              <button type="submit">Start Chat</button>
            </form>
          </div>
        ) : isConnecting ? (
          <div className="chat-loading">Connecting...</div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-message ${msg.is_from_agent ? "agent" : "customer"}`}
                  >
                    <div className="message-content">
                      <div className="message-sender">{msg.sender_name || (msg.is_from_agent ? "Agent" : "You")}</div>
                      {msg.text && <p>{msg.text}</p>}
                      {msg.attachment_url && (
                        <div className="message-attachment">
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                            📎 Attachment
                          </a>
                        </div>
                      )}
                      <div className="message-time">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {isClosed ? (
              <div className="chat-closed-notice">
                <p>{errorMessage || "This conversation has ended."}</p>
                <button 
                  type="button" 
                  className="chat-new-ticket-button" 
                  onClick={handleNewConversation}
                >
                  Start New Conversation
                </button>
              </div>
            ) : (
              <form className="chat-input-form" onSubmit={handleSendMessage}>
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
                <button
                  type="button"
                  className="chat-attach-button"
                  onClick={handleFileSelect}
                  title="Attach file"
                >
                  📎
                </button>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type your message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={uploading}
                />
                <button
                  type="submit"
                  className="chat-send-button"
                  disabled={uploading || (!inputText.trim() && !fileInputRef.current?.files[0])}
                >
                  {uploading ? "..." : "Send"}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <div className="chat-status">
        {connectionStatus === "CONNECTED" && <span className="status-online">● Online</span>}
        {connectionStatus === "CONNECTING" && <span className="status-connecting">● Connecting...</span>}
        {connectionStatus === "DISCONNECTED" && <span className="status-offline">● Offline</span>}
      </div>
    </div>
  );
}

