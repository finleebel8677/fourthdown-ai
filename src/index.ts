
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `
You are FOURTHDOWN AI, an expert NFL football analyst.

You analyze NFL players, teams, statistics, schemes, matchups and strategy.

IMPORTANT STATISTICS RULES:
- Use supplied NFL DATA CONTEXT whenever it contains relevant statistics.
- Never invent player statistics, rankings, records, injuries or game results.
- Clearly identify the season and whether statistics are regular-season or postseason.
- If requested information is missing, say that you do not have verified data for it.
- Distinguish actual statistics from predictions, opinions and projections.
- Explain football analysis clearly and provide useful context.
- When using statistics, identify nflverse as the data source.
`;

const CURRENT_YEAR = new Date().getUTCFullYear();

interface PlayerStats {
  name: string;
  position: string;
  teams: Set<string>;
  games: number;
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  rushing_yards: number;
  rushing_tds: number;
  carries: number;
  receiving_yards: number;
  receiving_tds: number;
  receptions: number;
  targets: number;
}

const DATA_URL =
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${CURRENT_YEAR}.csv`;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  result.push(value);
  return result;
}

function numberValue(value: string | undefined): number {
  if (!value || value === "NA") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function loadPlayerStats(): Promise<{
  players: PlayerStats[];
  season: number;
  retrieved: string;
}> {
  const cache = (globalThis as any).caches?.default;
  let response: Response | undefined;

  const cacheKey = new Request(DATA_URL);

  if (cache) {
    response = await cache.match(cacheKey);
  }

  if (!response) {
    response = await fetch(DATA_URL, {
      headers: { "User-Agent": "FOURTHDOWN-AI" },
    });

    if (!response.ok) {
      throw new Error(
        `NFL statistics source returned HTTP ${response.status}`,
      );
    }

    if (cache) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=1800");

      const cachedCopy = new Response(response.clone().body, {
        status: response.status,
        headers,
      });

      await cache.put(cacheKey, cachedCopy);
    }
  }

  if (!response.ok) {
    throw new Error("NFL statistics could not be loaded.");
  }

  const csv = await response.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("NFL statistics file was empty.");
  }

  const headers = parseCsvLine(lines[0]);
  const column = (name: string) => headers.indexOf(name);

  const nameColumn =
    column("player_display_name") >= 0
      ? column("player_display_name")
      : column("player_name");

  const idColumn = column("player_id");
  const positionColumn = column("position");
  const teamColumn =
    column("team") >= 0 ? column("team") : column("recent_team");
  const seasonTypeColumn = column("season_type");

  if (nameColumn < 0) {
    throw new Error("Player names were not found in the NFL data.");
  }

  const statColumns = {
    passing_yards: column("passing_yards"),
    passing_tds: column("passing_tds"),
    interceptions:
      column("interceptions") >= 0
        ? column("interceptions")
        : column("passing_interceptions"),
    rushing_yards: column("rushing_yards"),
    rushing_tds: column("rushing_tds"),
    carries:
      column("carries") >= 0
        ? column("carries")
        : column("rushing_attempts"),
    receiving_yards: column("receiving_yards"),
    receiving_tds: column("receiving_tds"),
    receptions: column("receptions"),
    targets: column("targets"),
  };

  const players = new Map<string, PlayerStats>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);

    if (seasonTypeColumn >= 0 && row[seasonTypeColumn] !== "REG") {
      continue;
    }

    const name = row[nameColumn]?.trim();
    if (!name) continue;

    const id =
      idColumn >= 0 && row[idColumn]
        ? row[idColumn]
        : name.toLowerCase();

    let player = players.get(id);

    if (!player) {
      player = {
        name,
        position:
          positionColumn >= 0 ? row[positionColumn] || "" : "",
        teams: new Set<string>(),
        games: 0,
        passing_yards: 0,
        passing_tds: 0,
        interceptions: 0,
        rushing_yards: 0,
        rushing_tds: 0,
        carries: 0,
        receiving_yards: 0,
        receiving_tds: 0,
        receptions: 0,
        targets: 0,
      };

      players.set(id, player);
    }

    if (teamColumn >= 0 && row[teamColumn]) {
      player.teams.add(row[teamColumn]);
    }

    player.games++;

    for (const key of Object.keys(statColumns) as Array<
      keyof typeof statColumns
    >) {
      const index = statColumns[key];

      if (index >= 0) {
        player[key] += numberValue(row[index]);
      }
    }
  }

  if (players.size === 0) {
    throw new Error("No player statistics were available.");
  }

  return {
    players: Array.from(players.values()),
    season: CURRENT_YEAR,
    retrieved: new Date().toISOString(),
  };
}

function buildNFLContext(
  data: Awaited<ReturnType<typeof loadPlayerStats>>,
  question: string,
): string {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

  const normalizedQuestion = normalize(question);

  const categories = [
    {
      label: "Passing yards",
      key: "passing_yards" as const,
    },
    {
      label: "Passing touchdowns",
      key: "passing_tds" as const,
    },
    {
      label: "Rushing yards",
      key: "rushing_yards" as const,
    },
    {
      label: "Receiving yards",
      key: "receiving_yards" as const,
    },
    {
      label: "Receiving touchdowns",
      key: "receiving_tds" as const,
    },
  ];

  const matched = data.players.filter((player) => {
    const name = normalize(player.name);
    return name.length > 3 && normalizedQuestion.includes(name);
  });

  const selected = new Set<PlayerStats>(matched.slice(0, 8));

  // Include leading players so the AI can answer leaderboard questions.
  for (const category of categories) {
    const leaders = [...data.players]
      .filter((player) => player[category.key] > 0)
      .sort(
        (a, b) => b[category.key] - a[category.key],
      )
      .slice(0, 5);

    leaders.forEach((player) => selected.add(player));
  }

  const formatPlayer = (player: PlayerStats) => {
    return [
      `${player.name} (${player.position || "Position unavailable"})`,
      `Team(s): ${Array.from(player.teams).join(", ") || "Unavailable"}`,
      `Games recorded: ${player.games}`,
      `Passing: ${player.passing_yards} yards, ${player.passing_tds} TD, ${player.interceptions} INT`,
      `Rushing: ${player.rushing_yards} yards, ${player.rushing_tds} TD, ${player.carries} carries`,
      `Receiving: ${player.receptions} receptions, ${player.receiving_yards} yards, ${player.receiving_tds} TD, ${player.targets} targets`,
    ].join(" | ");
  };

  const leaderboards = categories.map((category) => {
    const leaders = [...data.players]
      .filter((player) => player[category.key] > 0)
      .sort(
        (a, b) => b[category.key] - a[category.key],
      )
      .slice(0, 5);

    return (
      `${category.label}: ` +
      leaders
        .map(
          (player, index) =>
            `${index + 1}. ${player.name} (${player[category.key]})`,
        )
        .join("; ")
    );
  });

  return `
VERIFIED NFL DATA CONTEXT

Source: nflverse
Source URL: https://github.com/nflverse/nflverse-data/releases/tag/stats_player
Season: ${data.season}
Season type: Regular season
Retrieved: ${data.retrieved}

These are totals calculated by adding the weekly regular-season player statistics.

PLAYER RECORDS:
${Array.from(selected).map(formatPlayer).join("\n")}

LEADERBOARDS:
${leaderboards.join("\n")}

IMPORTANT:
Only use the figures supplied here as verified statistics.
The data may not include games that have not yet been processed by nflverse.
If a player is not listed, do not invent their statistics.
`;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      return handleChatRequest(request, env);
    }

    if (url.pathname === "/api/nfl/status") {
      return Response.json({
        service: "FOURTHDOWN AI NFL Statistics",
        source: "nflverse",
        season: CURRENT_YEAR,
        dataType: "Weekly player statistics",
        status: "Available through chat integration",
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
    };

    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return Response.json(
        { error: "Please send a message." },
        { status: 400 },
      );
    }

    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content || "";

    let nflContext = "";

    try {
      const data = await loadPlayerStats();
      nflContext = buildNFLContext(data, latestQuestion);
    } catch (error) {
      console.error("NFL data unavailable:", error);
      nflContext = `
NFL DATA WARNING:
The live nflverse player statistics could not be retrieved.
Do not invent or guess current NFL statistics.
Tell the user that verified statistics are temporarily unavailable.
`;
    }

    let systemMessage = messages.find(
      (message) => message.role === "system",
    );

    if (!systemMessage) {
      systemMessage = {
        role: "system",
        content: SYSTEM_PROMPT,
      };
      messages.unshift(systemMessage);
    } else {
      systemMessage.content =
        SYSTEM_PROMPT + "\n\n" + systemMessage.content;
    }

    systemMessage.content += "\n\n" + nflContext;

    const inputs = {
      messages,
      max_tokens: 1200,
      stream: true,
    } satisfies AiTextGenerationInput & { stream: true };

    const stream = await env.AI.run<typeof MODEL_ID>(
      MODEL_ID,
      inputs,
    );

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to process request",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }
}
