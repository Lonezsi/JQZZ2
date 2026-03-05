import { useState, useEffect } from "react";
import type { SubmitEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINT } from "./config/api";
import "./Dashboard.css";

interface Lobby {
  id: number;
  name: string;
}

const Dashboard = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [lobbyName, setLobbyName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<Lobby[]>(`${API_ENDPOINT}/lobbies`)
      .then((res) => setLobbies(res.data))
      .catch(console.error);
  }, []);

  const createLobby = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await axios.post<Lobby>(`${API_ENDPOINT}/lobbies`, {
      name: lobbyName,
      adminId: 1,
    });
    navigate(`/lobby/${res.data.id}`);
  };

  return (
    <div className="dashboard-container">
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-logo">
            <img src="/logo.png" alt="JQZZ Logo" />
          </div>
          <div className="hero-text">
            <h1>JQZZ</h1>
            <p className="tagline">Experience Interactive Quiz Gaming</p>
          </div>
        </div>
      </section>

      <div className="main-container">
        <div className="bento-grid">
          <div className="bento-box bento-box-large">
            <div className="box-header">
              <h2>Create New Lobby</h2>
              <p>Start a new quiz session</p>
            </div>
            <form onSubmit={createLobby} className="lobby-form">
              <input
                type="text"
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
                placeholder="Enter lobby name"
                required
              />
              <button type="submit" className="btn-primary">
                Create Lobby
              </button>
            </form>
          </div>

          <div className="bento-box bento-box-large">
            <div className="box-header">
              <h2>Join Existing Lobby</h2>
              <p>
                {lobbies.length} lobby{lobbies.length !== 1 ? "ies" : ""}{" "}
                available
              </p>
            </div>
            {lobbies.length > 0 ? (
              <div className="lobby-list">
                {lobbies.map((lobby) => (
                  <div key={lobby.id} className="lobby-item">
                    <div className="lobby-info">
                      <span className="lobby-name">{lobby.name}</span>
                      <span className="lobby-id">ID: {lobby.id}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/lobby/${lobby.id}`)}
                      className="btn-join"
                    >
                      Join →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No lobbies available yet. Create one to get started!</p>
              </div>
            )}
          </div>

          <div className="bento-box">
            <h3>📊 Total Lobbies</h3>
            <div className="stat-number">{lobbies.length}</div>
            <p className="stat-label">Active quiz sessions</p>
          </div>

          <div className="bento-box">
            <h3>🎯 Quick Start</h3>
            <p>Jump into a lobby and test your knowledge with friends!</p>
            <button className="btn-secondary">Learn More</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
