import React, { useEffect, useState } from "react";
import type { User } from "../../types";
import { api } from "../../services/api";
import { GenAvatar } from "./GenAvatar";

// image reference -> URL, shared by every avatar on the page
const resolved = new Map<string, Promise<string | null>>();

/** a generated picture's seed, stored as "gen:<seed>" instead of an image */
const GEN = "gen:";

// eslint-disable-next-line react-refresh/only-export-components
export function resolveImage(ref: string, ownerId: string, viewerId: string) {
  if (/^(https?:|data:)/.test(ref)) return Promise.resolve(ref);
  // ":handle" is relative to the picture's owner, not to whoever is looking
  const absolute = ref.startsWith(":") ? `${ownerId}${ref}` : ref;
  const key = `${viewerId}|${absolute}`;
  let url = resolved.get(key);
  if (!url) {
    url = api
      .get("/images/resolve", {
        params: { ref: absolute },
        headers: { "X-User-Id": viewerId },
      })
      .then(
        (res) =>
          `${api.defaults.baseURL}/images/${res.data.id}?userId=${encodeURIComponent(viewerId)}`,
      )
      .catch(() => null); // private to its owner, or deleted: show the initial
    resolved.set(key, url);
  }
  return url;
}

interface AvatarProps {
  user: Pick<User, "id" | "name" | "profilePictureUrl">;
  viewerId: string | undefined;
  className: string;
}

/**
 * Profile picture. Without an uploaded one, a generated face: from the stored
 * seed if they rerolled, otherwise from their id, so everyone sees the same one.
 */
export const Avatar: React.FC<AvatarProps> = ({ user, viewerId, className }) => {
  const ref = user.profilePictureUrl;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ref || !viewerId || ref.startsWith(GEN)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    let cancelled = false;
    resolveImage(ref, user.id, viewerId).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [ref, user.id, viewerId]);

  const seed = ref?.startsWith(GEN) ? ref.slice(GEN.length) : user.id;

  return (
    <div className={className} style={{ overflow: "hidden" }}>
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <GenAvatar seed={seed} name={user.name} />
      )}
    </div>
  );
};
