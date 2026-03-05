import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import LobbyView from "./LobbyView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lobby/:id" element={<LobbyView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
