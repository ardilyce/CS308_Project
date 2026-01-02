const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

/**
 * Generate or retrieve guest token from localStorage
 */
export function getGuestToken() {
  let token = localStorage.getItem("chat_guest_token");
  if (!token) {
    // Generate a simple token
    token = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("chat_guest_token", token);
  }
  return token;
}

/**
 * Connect to WebSocket for a conversation
 */
export function connectChat(conversationId, onMessage, onError, onClose) {
  // Close existing connection if any
  if (wsConnection) {
    wsConnection.close();
  }

  const token = localStorage.getItem("accessToken");
  const guestToken = getGuestToken();

  // Build WebSocket URL
  const protocol = API_BASE.startsWith("https") ? "wss://" : "ws://";
  const host = API_BASE.replace(/^https?:\/\//, "").replace(/\/$/, "");
  let wsUrl = `${protocol}${host}/ws/support/chat/${conversationId}/`;
  
  // Add authentication
  if (token) {
    wsUrl += `?token=${encodeURIComponent(token)}`;
  } else {
    wsUrl += `?guest_token=${encodeURIComponent(guestToken)}`;
  }

  try {
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
      console.log("WebSocket connected");
      reconnectAttempts = 0;
    };

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && onMessage) {
          onMessage(data.data);
        } else if (data.type === "error") {
          console.error("WebSocket error:", data.message);
          if (onError) onError(data.message);
        } else if (data.type === "ticket_closed") {
          console.log("Ticket closed:", data.message);
          if (onError) onError(data.message);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    wsConnection.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (onError) onError("Connection error");
    };

    wsConnection.onclose = (event) => {
      console.log("WebSocket closed", event.code, event.reason);
      if (onClose) onClose(event);

      // Attempt to reconnect if not a normal closure
      if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
          console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
          connectChat(conversationId, onMessage, onError, onClose);
        }, RECONNECT_DELAY);
      }
    };
  } catch (error) {
    console.error("Failed to create WebSocket connection:", error);
    if (onError) onError("Failed to connect");
  }

  return wsConnection;
}

/**
 * Send a message via WebSocket
 */
export function sendMessage(text, attachmentUrl = null) {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    console.error("WebSocket is not connected");
    return false;
  }

  try {
    wsConnection.send(JSON.stringify({
      type: "message",
      text: text,
      attachment_url: attachmentUrl,
    }));
    return true;
  } catch (error) {
    console.error("Failed to send message:", error);
    return false;
  }
}

/**
 * Disconnect from WebSocket
 */
export function disconnectChat() {
  if (wsConnection) {
    wsConnection.close(1000, "User disconnected");
    wsConnection = null;
  }
}

/**
 * Get WebSocket connection state
 */
export function getConnectionState() {
  if (!wsConnection) return "DISCONNECTED";
  
  switch (wsConnection.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "CONNECTED";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "DISCONNECTED";
    default:
      return "UNKNOWN";
  }
}

