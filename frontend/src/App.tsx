import { Dashboard } from "./components/Dashboard/Dashboard";
import { HostScreen } from "./components/Play/HostScreen";
import { PlayScreen } from "./components/Play/PlayScreen";
import { JoinScreen } from "./components/Play/JoinScreen";
import { useHashRoute } from "./hooks/useHashRoute";

/* Hash routes, so the app needs nothing from the server it's served by:
   #/host/CODE   the big screen for a game you host
   #/play/CODE   your phone in a game
   #/join[/CODE] typing in a code, or arriving with one
   anything else the editor */
function App() {
  const route = useHashRoute();
  const [, where, code] = route.split("/");
  if (where === "host" && code) return <HostScreen code={code.toUpperCase()} />;
  if (where === "play" && code) return <PlayScreen code={code.toUpperCase()} />;
  if (where === "join") return <JoinScreen code={code} />;
  return <Dashboard />;
}

export default App;
