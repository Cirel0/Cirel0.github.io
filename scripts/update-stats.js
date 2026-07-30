#!/usr/bin/env node
/**
 * Fetches Roblox CCU + visits for games listed in data/games.json
 * and writes data/stats.json. Games without a placeId keep prior stats.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GAMES_PATH = path.join(ROOT, "data", "games.json");
const STATS_PATH = path.join(ROOT, "data", "stats.json");

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Cirel0-github-io-stats-bot",
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function universeIdForPlace(placeId) {
  const data = await fetchJSON(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );
  return data.universeId;
}

async function gameStatsForUniverses(universeIds) {
  if (!universeIds.length) return [];
  const qs = universeIds.join(",");
  const data = await fetchJSON(
    `https://games.roblox.com/v1/games?universeIds=${qs}`
  );
  return data.data || [];
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const games = readJSON(GAMES_PATH, []);
  const previous = readJSON(STATS_PATH, { games: {}, totals: {} });
  const nextGames = { ...(previous.games || {}) };

  const withPlace = games.filter((game) => game.placeId);
  const universeMap = new Map();

  for (const game of withPlace) {
    try {
      const universeId = await universeIdForPlace(game.placeId);
      universeMap.set(universeId, game);
      await new Promise((r) => setTimeout(r, 150));
    } catch (error) {
      console.warn(`Universe lookup failed for ${game.id}:`, error.message);
    }
  }

  try {
    const remote = await gameStatsForUniverses([...universeMap.keys()]);
    for (const entry of remote) {
      const game = universeMap.get(entry.id);
      if (!game) continue;
      nextGames[game.id] = {
        playing: entry.playing ?? 0,
        visits: entry.visits ?? 0,
        name: entry.name || game.name,
        placeId: game.placeId,
        universeId: entry.id,
      };
    }
  } catch (error) {
    console.warn("Batch games fetch failed:", error.message);
  }

  for (const game of games) {
    if (!nextGames[game.id]) {
      nextGames[game.id] = previous.games?.[game.id] || {
        playing: 0,
        visits: 0,
        name: game.name,
      };
    }
  }

  // Drop stats for removed games
  for (const id of Object.keys(nextGames)) {
    if (!games.some((game) => game.id === id)) delete nextGames[id];
  }

  const totals = Object.values(nextGames).reduce(
    (acc, row) => {
      acc.playing += Number(row.playing) || 0;
      acc.visits += Number(row.visits) || 0;
      return acc;
    },
    { playing: 0, visits: 0 }
  );

  const payload = {
    updatedAt: new Date().toISOString(),
    totals,
    games: nextGames,
  };

  const prevComparable = {
    totals: previous.totals || {},
    games: previous.games || {},
  };
  const nextComparable = { totals, games: nextGames };
  const unchanged =
    JSON.stringify(prevComparable) === JSON.stringify(nextComparable);

  if (unchanged) {
    console.log("Stats unchanged; leaving stats.json as-is");
    return;
  }

  fs.writeFileSync(STATS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Updated stats.json — CCU ${totals.playing}, visits ${totals.visits}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
