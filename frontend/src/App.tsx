import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import LobbyView from "./LobbyView";
import ErrorBanner from "./components/ErrorBanner";

function App() {
  return (
    <>
      <ErrorBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lobby/:id" element={<LobbyView />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
