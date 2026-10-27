import { useEffect, useState } from "react";

/** The part after "#", e.g. "/play/ABCDE". Hash routes need no server help. */
export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, ""));
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (route: string) => {
  window.location.hash = route;
};

/** where someone types in the code, or follows a link to it */
export const joinUrl = (code: string) =>
  `${window.location.origin}${window.location.pathname}#/join/${code}`;
