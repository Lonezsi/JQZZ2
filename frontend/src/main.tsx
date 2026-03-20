import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import App from "./App";
import "./index.css";
import { QuizProvider } from "./contexts/QuizContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <QuizProvider>
          <App />
        </QuizProvider>
      </WebSocketProvider>
    </AuthProvider>
  </React.StrictMode>,
);
