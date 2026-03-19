import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { Dashboard } from "./components/Dashboard/Dashboard";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <Dashboard />
      </WebSocketProvider>
    </AuthProvider>
  </React.StrictMode>,
);
