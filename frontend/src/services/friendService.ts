import { api } from "./api";

/* Friends: asking, accepting, removing. Who you are travels in X-User-Id. */

export interface FriendPerson {
  id: string;
  name: string;
  handle: string;
  profilePictureUrl?: string | null;
  online: boolean;
}

export interface FriendLists {
  friends: FriendPerson[];
  /** they asked you */
  incoming: FriendPerson[];
  /** you asked them */
  outgoing: FriendPerson[];
}

/** how you stand with someone, as /profile tells it */
export type Friendship = "self" | "friends" | "incoming" | "outgoing" | "none";

const as = (userId: string) => ({ headers: { "X-User-Id": userId } });

export const friendService = {
  list: (userId: string) => api.get<FriendLists>("/friends", as(userId)).then((r) => r.data),
  /** ask, or accept when they asked first */
  add: (userId: string, otherId: string) =>
    api.post<FriendLists>(`/friends/${encodeURIComponent(otherId)}`, null, as(userId)).then((r) => r.data),
  /** unfriend, take back a request, or turn one down */
  remove: (userId: string, otherId: string) =>
    api.delete<FriendLists>(`/friends/${encodeURIComponent(otherId)}`, as(userId)).then((r) => r.data),
};
