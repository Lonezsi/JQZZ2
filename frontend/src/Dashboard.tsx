import { useState, useEffect, FormEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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
      .get<Lobby[]>("http://localhost:8080/api/lobbies")
      .then((res) => setLobbies(res.data))
      .catch(console.error);
  }, []);

  const createLobby = async (e: FormEvent) => {
    e.preventDefault();
    const res = await axios.post<Lobby>("http://localhost:8080/api/lobbies", {
      name: lobbyName,
      adminId: 1,
    });
    navigate(`/lobby/${res.data.id}`);
  };

  return (
    <section className="bento-grid">
      <div className="bento-box paper-bg">
        <h3>Create Lobby</h3>
        <form onSubmit={createLobby}>
          <input
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder="Lobby Name"
            required
          />
          <button type="submit">Create</button>
        </form>
      </div>

      <div className="bento-box paper-bg">
        <h3>Available Lobbies</h3>
        <div className="lobby-list">
          {lobbies.map((lobby) => (
            <div key={lobby.id} className="lobby-item">
              <span>{lobby.name}</span>
              <button onClick={() => navigate(`/lobby/${lobby.id}`)}>
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
