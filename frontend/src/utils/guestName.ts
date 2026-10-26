/* Names for accounts nobody has named yet: two words and "(guest)".
   The hourly cleanup uses isGuestName to find the unclaimed ones. */

const FIRST = [
  "Velvet", "Feral", "Gloomy", "Chrome", "Sleepy", "Cursed", "Tiny", "Lunar",
  "Static", "Rusty", "Holy", "Spicy", "Neon", "Dusty", "Wicked", "Soggy",
  "Quiet", "Haunted", "Grainy", "Prism", "Molten", "Feathered", "Silent", "Sour",
  "Glitter", "Hollow", "Crooked", "Midnight", "Paper", "Fuzzy", "Electric", "Gothic",
  "Lucky", "Smug", "Frosted", "Sunken", "Stray", "Velour", "Copper", "Cosmic",
];

const SECOND = [
  "Moth", "Toad", "Goblin", "Ghost", "Comet", "Bishop", "Raven", "Otter",
  "Wizard", "Gremlin", "Pigeon", "Knight", "Oracle", "Badger", "Jester", "Leech",
  "Monk", "Lantern", "Crow", "Hermit", "Sprite", "Possum", "Fox", "Wraith",
  "Cherub", "Beetle", "Gargoyle", "Heron", "Imp", "Sphinx", "Weasel", "Duke",
  "Squid", "Pilgrim", "Ferret", "Saint", "Bandit", "Golem", "Newt", "Vandal",
];

const pick = (words: string[]) => words[Math.floor(Math.random() * words.length)];

/** e.g. "Velvet Moth (guest)" */
export const guestName = () => `${pick(FIRST)} ${pick(SECOND)} (guest)`;

/** a name this app handed out, new style or old ("Guest_1234") */
export const isGuestName = (name: string | null | undefined) =>
  !!name && (name.endsWith("(guest)") || name.startsWith("Guest_"));

/** a seed for a new generated picture, stored as "gen:<seed>" */
export const avatarSeed = () => `gen:${Math.random().toString(36).slice(2, 10)}`;
