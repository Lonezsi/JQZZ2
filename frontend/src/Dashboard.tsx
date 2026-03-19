import { useState, useEffect } from "react";
import type { SubmitEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINT } from "./config/api";
import useGameStore from "./store/gameStore";
import "./Dashboard.css";

interface Lobby {
  id: number;
  name: string;
}

interface User {
  id: string;
  handle: string;
  name: string;
  online: boolean;
}

const Dashboard = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lobbyName, setLobbyName] = useState("");

  // 🔥 unified auth state
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);

  const userId = useGameStore((s) => s.userId);
  const setUserId = useGameStore((s) => s.setUserId);
  const setUserName = useGameStore((s) => s.setUserName);
  const setErrorMessage = useGameStore((s) => s.setErrorMessage);

  const navigate = useNavigate();

  // 🔥 LIVE HANDLE CHECK
  useEffect(() => {
    if (!handle) {
      setUserExists(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await axios.get<User[]>(`${API_ENDPOINT}/users`);
        const found = res.data.find((u) => u.handle === handle);
        setUserExists(!!found);
      } catch {
        setUserExists(null);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [handle]);

  // fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersRes = await axios.get<User[]>(`${API_ENDPOINT}/users`);
        setUsers(
          usersRes.data.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)),
        );

        const lobbiesRes = await axios.get<Lobby[]>(`${API_ENDPOINT}/lobbies`);
        setLobbies(lobbiesRes.data);
      } catch (err) {
        setErrorMessage(`Failed to load data: ${err}`);
      }
    };

    fetchData();
  }, [setErrorMessage]);

  // 🔥 unified login/register
  const handleAuth = async (e: SubmitEvent) => {
    e.preventDefault();

    try {
      if (userExists) {
        const user = users.find((u) => u.handle === handle);
        if (!user) return;

        const res = await axios.post(`${API_ENDPOINT}/users/login`, {
          id: user.id,
        });

        setUserId(res.data.id);
        setUserName(res.data.name);
      } else {
        const res = await axios.post(`${API_ENDPOINT}/users/register`, {
          name: name || handle || "Guest",
        });

        setUserId(res.data.id);
        setUserName(res.data.name);
      }
    } catch (err) {
      setErrorMessage(`Auth failed: ${err}`);
    }
  };

  const createLobby = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await axios.post<Lobby>(`${API_ENDPOINT}/lobbies`, {
        name: lobbyName,
        adminId: userId,
      });
      navigate(`/lobby/${res.data.id}`);
    } catch (err) {
      setErrorMessage(`Failed to create lobby: ${err}`);
    }
  };

  const renameUser = (id: string, newName: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, name: newName } : u)),
    );

    axios
      .post(`${API_ENDPOINT}/users/${id}/name`, { name: newName })
      .catch((err) => setErrorMessage(`Failed to rename user: ${err}`));
  };

  return (
    <div className="dashboard-container">
      <div className="main-container">
        <div className="bento-grid">
          {/* HERO (unchanged) */}
          <div className="bento-box hero-section">
            <div className="hero-logo">
              <img src="/logo.png" alt="JQZZ Logo" />
            </div>
            <div className="hero-text align-center">
              <h1>---JQzz---</h1>
              <p className="tagline">
                Egy teljesen egyedi weboldal, a kompetíció egyébként is béna (és
                még drága is)
              </p>
              <h1 className="tag">;Lonezsi</h1>
            </div>
          </div>

          {/* 🔥 AUTH BOX (NEW but same style slot) */}
          <div className="bento-box">
            <div className="box-header">
              <h2>Account</h2>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              <input
                type="text"
                placeholder="Handle..."
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />

              <button
                type="button"
                className="dropdown-toggle"
                onClick={() => setExtraOpen(!extraOpen)}
              >
                {extraOpen ? "Less ▲" : "More ▼"}
              </button>

              {extraOpen && (
                <div className="dropdown-area">
                  <input
                    type="text"
                    placeholder="Display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <button type="submit" className="btn-primary">
                {userExists === null
                  ? "Continue"
                  : userExists
                    ? "Login"
                    : "Register"}
              </button>
            </form>
          </div>

          {/* CREATE LOBBY (kept) */}
          <div className="bento-box">
            <div className="box-header">
              <h2>Create New Lobby</h2>
            </div>

            <form onSubmit={createLobby} className="lobby-form">
              <input
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

          {/* USERS (kept, but live typing already good) */}
          <div className="bento-box">
            <div className="box-header">
              <h2>Users</h2>
            </div>

            <div className="user-list-box">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`user-item ${user.online ? "online" : ""}`}
                >
                  <input
                    value={user.name}
                    onChange={(e) => renameUser(user.id, e.target.value)}
                  />
                  <span className="user-status">
                    {user.online ? "Online" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* LOBBIES (kept) */}
          <div className="bento-box">
            <div className="box-header">
              <h2>Join Existing Lobby</h2>
            </div>

            {lobbies.length > 0 ? (
              <div className="lobby-list">
                {lobbies.map((lobby) => (
                  <div key={lobby.id} className="lobby-item">
                    <span className="lobby-name">{lobby.name}</span>
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
                <p>No lobbies yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
