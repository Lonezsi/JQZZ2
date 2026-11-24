import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import App from "./App";
// the fonts come from here, not Google (Condom legal 1)
import "@fontsource/albert-sans/400.css";
import "@fontsource/albert-sans/500.css";
import "@fontsource/albert-sans/600.css";
import "@fontsource/albert-sans/700.css";
import "@fontsource/albert-sans/800.css";
import "@fontsource/albert-sans/400-italic.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/spline-sans-mono/400.css";
import "@fontsource/spline-sans-mono/500.css";
import "@fontsource/spline-sans-mono/700.css";
import "./index.css";
import { QuizProvider } from "./contexts/QuizContext";
import { watchTheme } from "./utils/theme";
import { Ground } from "./components/common/Ground";

watchTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Ground />
    <AuthProvider>
      <WebSocketProvider>
        <QuizProvider>
          <App />
        </QuizProvider>
      </WebSocketProvider>
    </AuthProvider>
  </React.StrictMode>,
);
