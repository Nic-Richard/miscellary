const effects =
  "You won't see each other's posts, comments or notifications, and you can't follow or trade with each other. They won't be told.";

export const BLOCK_COPY = {
  effects,
  confirm: (username: string) => `Block @${username}? ${effects}`,
  explain:
    "Blocked collectors can't follow you, trade with you or reply to you, and you won't see their posts, comments or notifications. They aren't told.",
  empty: "You haven't blocked anyone.",
  blocked: "You've blocked this collector.",
};
