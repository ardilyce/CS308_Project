import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { hydrateAuthFromStorage, setupAxiosInterceptors } from "./lib/auth";

// Setup axios interceptors first to handle 401 errors
setupAxiosInterceptors();

// Then hydrate auth state from localStorage
hydrateAuthFromStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
