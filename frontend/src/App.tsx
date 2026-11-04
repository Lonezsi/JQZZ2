import { lazy, Suspense } from "react";
import { Loading } from "./components/common/Loading";
import type { Place } from "./hooks/useSpace";
import { Notifications } from "./components/common/Notifications";
import { ReturnToGame } from "./components/common/ReturnToGame";
import { Tooltip } from "./components/common/Tooltip";
import { useTouchDrag } from "./hooks/useTouchDrag";
import { useHashRoute } from "./hooks/useHashRoute";
import { useNavShortcuts } from "./hooks/useNavShortcuts";
// Esc closes what's open, then goes up a level: from the first page on
import "./hooks/useEscape";

/* Hash routes, so the app needs nothing from the server it's served by:
   #/host/CODE         the big screen for a game you host
   #/play/CODE         your phone in a game
   #/join[/CODE]       typing in a code, or arriving with one
   #/me[/TAB[/SUB]]    your profile: history, the stash and its shelves, notifications
   #/u/ID[/TAB]        someone else's profile
   #/history/ID        one finished game
   #/stash/add/KIND/REF  a share link: copies the item into your stash
   #/stash, #/history  older links, now your profile's tabs
   #/admin[/TAB]       the admin panel, for the admin account only
   anything else the editor

   Each page is its own download, fetched when it's first shown: a phone
   joining with a code never loads the editor. */
const Dashboard = lazy(() => import("./components/Dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const HostScreen = lazy(() => import("./components/Play/HostScreen").then((m) => ({ default: m.HostScreen })));
const PlayScreen = lazy(() => import("./components/Play/PlayScreen").then((m) => ({ default: m.PlayScreen })));
const JoinScreen = lazy(() => import("./components/Play/JoinScreen").then((m) => ({ default: m.JoinScreen })));
const HistoryPage = lazy(() => import("./components/Stash/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const AdminPage = lazy(() => import("./components/Admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const ProfilePage = lazy(() => import("./components/Stash/ProfilePage").then((m) => ({ default: m.ProfilePage })));
/* a bare sheet to try the brushes on, while working on them */
const Sketch = import.meta.env.DEV ? lazy(() => import("./draw/Sketch")) : null;

function App() {
  const route = useHashRoute();
  useNavShortcuts();
  useTouchDrag();
  const [, where, a, b, c] = route.split("/");
  return (
    <>
      {/* the shared background stays up while a page's code is on its way, with a small spinner if it takes a moment */}
      <Suspense fallback={<Loading page place={routePlace(where, a, b)} />}>{page(where, a, b, c)}</Suspense>
      <Notifications />
      <ReturnToGame />
      <Tooltip />
    </>
  );
}

const SELF_TABS = ["history", "stash", "notifications", "you", "settings"];
const OTHER_TABS = ["history", "shelf", "friends"];

/** which place the page for a route lives in, known before its code has loaded */
function routePlace(where?: string, a?: string, b?: string): Place | undefined {
  if (where === "host" || where === "play" || where === "join") return "game";
  if (where === "me") return (SELF_TABS.includes(a ?? "") ? a : "history") as Place;
  if (where === "u") return (OTHER_TABS.includes(b ?? "") ? b : "history") as Place;
  if (where === "history") return "history";
  if (where === "stash") return "stash";
  if (where === "admin") return "admin";
  if (where === "draw") return undefined;
  return "front";
}

function page(where?: string, a?: string, b?: string, c?: string) {
  // one screen per game: going from one game to the next (a rematch) starts the screen afresh
  if (where === "host" && a) return <HostScreen key={a.toUpperCase()} code={a.toUpperCase()} />;
  if (where === "play" && a) return <PlayScreen key={a.toUpperCase()} code={a.toUpperCase()} />;
  if (where === "join") return <JoinScreen code={a} />;
  if (where === "me") return <ProfilePage tab={a} sub={b} />;
  if (where === "u" && a) return <ProfilePage userId={decodeURIComponent(a)} tab={b} />;
  if (where === "history" && a) return <HistoryPage id={a} />;
  if (where === "history") return <ProfilePage tab="history" />;
  if (where === "stash" && a === "add" && b && c) {
    return <ProfilePage tab="stash" add={{ kind: b, ref: decodeURIComponent(c) }} />;
  }
  if (where === "stash") return <ProfilePage tab="stash" sub={a} />;
  if (where === "admin") return <AdminPage tab={a} />;
  if (where === "draw" && Sketch) return <Sketch />;
  return <Dashboard />;
}

export default App;
