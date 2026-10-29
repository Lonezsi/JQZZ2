import { Dashboard } from "./components/Dashboard/Dashboard";
import { HostScreen } from "./components/Play/HostScreen";
import { PlayScreen } from "./components/Play/PlayScreen";
import { JoinScreen } from "./components/Play/JoinScreen";
import { HistoryPage } from "./components/Stash/HistoryPage";
import { ProfilePage } from "./components/Stash/ProfilePage";
import { Notifications } from "./components/common/Notifications";
import { ReturnToGame } from "./components/common/ReturnToGame";
import { Tooltip } from "./components/common/Tooltip";
import { useTouchDrag } from "./hooks/useTouchDrag";
import { useHashRoute } from "./hooks/useHashRoute";
import { useNavShortcuts } from "./hooks/useNavShortcuts";

/* Hash routes, so the app needs nothing from the server it's served by:
   #/host/CODE         the big screen for a game you host
   #/play/CODE         your phone in a game
   #/join[/CODE]       typing in a code, or arriving with one
   #/me[/TAB[/SUB]]    your profile: history, the stash and its shelves, notifications
   #/u/ID[/TAB]        someone else's profile
   #/history/ID        one finished game
   #/stash/add/KIND/REF  a share link: copies the item into your stash
   #/stash, #/history  older links, now your profile's tabs
   anything else the editor */
function App() {
  const route = useHashRoute();
  useNavShortcuts();
  useTouchDrag();
  const [, where, a, b, c] = route.split("/");
  return (
    <>
      {page(where, a, b, c)}
      <Notifications />
      <ReturnToGame />
      <Tooltip />
    </>
  );
}

function page(where?: string, a?: string, b?: string, c?: string) {
  if (where === "host" && a) return <HostScreen code={a.toUpperCase()} />;
  if (where === "play" && a) return <PlayScreen code={a.toUpperCase()} />;
  if (where === "join") return <JoinScreen code={a} />;
  if (where === "me") return <ProfilePage tab={a} sub={b} />;
  if (where === "u" && a) return <ProfilePage userId={decodeURIComponent(a)} tab={b} />;
  if (where === "history" && a) return <HistoryPage id={a} />;
  if (where === "history") return <ProfilePage tab="history" />;
  if (where === "stash" && a === "add" && b && c) {
    return <ProfilePage tab="stash" add={{ kind: b, ref: decodeURIComponent(c) }} />;
  }
  if (where === "stash") return <ProfilePage tab="stash" sub={a} />;
  return <Dashboard />;
}

export default App;
