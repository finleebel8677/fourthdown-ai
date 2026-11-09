
import { Env, ChatMessage } from "./types";
import {
  asyncBufferFromUrl,
  parquetMetadataAsync,
  parquetSchema,
  parquetReadObjects
} from "hyparquet";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const RUNTIME_YEAR = new Date().getUTCFullYear();

const CURRENT_YEAR =
    RUNTIME_YEAR >= 2020 && RUNTIME_YEAR <= 2100
        ? RUNTIME_YEAR
        : 2026;

const SYSTEM_PROMPT = `
You are FOURTHDOWN AI, an expert NFL football analyst.

Analyze NFL players, teams, statistics, schemes, matchups and strategy.

STATISTICS RULES:
- Use verified NFL DATA CONTEXT supplied with the request.
- Never invent player statistics, rankings, records, injuries or results.
- Identify the season associated with every statistic.
- Never describe previous-season statistics as current-season statistics.
- If verified data is unavailable, say so clearly.
- Distinguish actual statistics from predictions and opinions.
- Identify nflverse as the source of supplied statistics.
- Do not pretend to have live tracking data or live game information.
- You may still answer general football strategy questions.
`;

type StatKey =
  | "passing_yards"
  | "passing_tds"
  | "interceptions"
  | "rushing_yards"
  | "rushing_tds"
  | "carries"
  | "receiving_yards"
  | "receiving_tds"
  | "receptions"
  | "targets";

interface PlayerStats {
  id: string;
  name: string;
  position: string;
  teams: string[];
  weeks: number[];
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

interface LoadedStats {
  players: PlayerStats[];
  season: number;
  isCurrentSeason: boolean;
  retrievedAt: string;
  sourceUrl: string;
}

const STAT_CATEGORIES: {
  label: string;
  key: StatKey;
}[] = [
  { label: "Passing yards", key: "passing_yards" },
  { label: "Passing touchdowns", key: "passing_tds" },
  { label: "Interceptions", key: "interceptions" },
  { label: "Rushing yards", key: "rushing_yards" },
  { label: "Rushing touchdowns", key: "rushing_tds" },
  { label: "Carries", key: "carries" },
  { label: "Receiving yards", key: "receiving_yards" },
  { label: "Receiving touchdowns", key: "receiving_tds" },
  { label: "Receptions", key: "receptions" },
  { label: "Targets", key: "targets" }
];

function dataUrl(year: number): string {
  return (
    "https://github.com/nflverse/nflverse-data/releases/download/" +
    `stats_player/stats_player_week_${year}.parquet`
  );
}

function numberValue(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "NA"
  ) {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

let memoryCache: LoadedStats | null = null;
let memoryCacheTime = 0;

const CACHE_DURATION = 15 * 60 * 1000;

async function downloadAndProcess(
  year: number
): Promise<LoadedStats> {
  const url = dataUrl(year);

  const file = await asyncBufferFromUrl({
    url
  });

  const metadata = await parquetMetadataAsync(file);
  const schema = parquetSchema(metadata);

  const availableColumns = schema.children.map(
    (child: any) => child.element.name
  );

  const requestedColumns = [
    "player_id",
    "player_name",
    "player_display_name",
    "position",
    "team",
    "recent_team",
    "season",
    "season_type",
    "week",
    "passing_yards",
    "passing_tds",
    "interceptions",
    "passing_interceptions",
    "rushing_yards",
    "rushing_tds",
    "carries",
    "rushing_attempts",
    "receiving_yards",
    "receiving_tds",
    "receptions",
    "targets"
  ];

  const columns = requestedColumns.filter(
    column => availableColumns.includes(column)
  );

  if (
    !columns.includes("player_name") &&
    !columns.includes("player_display_name")
  ) {
    throw new Error(
      "The Parquet file does not contain player-name columns."
    );
  }

  const rows = await parquetReadObjects({
    file,
    columns
  }) as Record<string, unknown>[];

  if (!rows || rows.length === 0) {
    throw new Error(
      `The ${year} NFL statistics file contains no records.`
    );
  }

  const players = new Map<string, PlayerStats>();

  for (const row of rows) {
    const rowSeason = numberValue(row.season);

    if (rowSeason && rowSeason !== year) continue;

    const seasonType = stringValue(row.season_type);

    if (seasonType && seasonType !== "REG") continue;

    const name =
      stringValue(row.player_display_name) ||
      stringValue(row.player_name);

    if (!name) continue;

    const id =
      stringValue(row.player_id) ||
      normalize(name);

    let player = players.get(id);

    if (!player) {
      player = {
        id,
        name,
        position: stringValue(row.position),
        teams: [],
        weeks: [],
        passing_yards: 0,
        passing_tds: 0,
        interceptions: 0,
        rushing_yards: 0,
        rushing_tds: 0,
        carries: 0,
        receiving_yards: 0,
        receiving_tds: 0,
        receptions: 0,
        targets: 0
      };

      players.set(id, player);
    }

    const team =
      stringValue(row.team) ||
      stringValue(row.recent_team);

    if (team && !player.teams.includes(team)) {
      player.teams.push(team);
    }

    const week = numberValue(row.week);

    if (week > 0 && !player.weeks.includes(week)) {
      player.weeks.push(week);
    }

    player.passing_yards += numberValue(row.passing_yards);
    player.passing_tds += numberValue(row.passing_tds);

    player.interceptions += numberValue(
      row.interceptions ?? row.passing_interceptions
    );

    player.rushing_yards += numberValue(row.rushing_yards);
    player.rushing_tds += numberValue(row.rushing_tds);

    player.carries += numberValue(
      row.carries ?? row.rushing_attempts
    );

    player.receiving_yards += numberValue(row.receiving_yards);
    player.receiving_tds += numberValue(row.receiving_tds);
    player.receptions += numberValue(row.receptions);
    player.targets += numberValue(row.targets);
  }

  const result = Array.from(players.values());

  if (result.length === 0) {
    throw new Error(
      `No usable player statistics were found for ${year}.`
    );
  }

  return {
    players: result,
    season: year,
    isCurrentSeason: year === CURRENT_YEAR,
    retrievedAt: new Date().toISOString(),
    sourceUrl: url
  };
}

async function loadPlayerStats(): Promise<LoadedStats> {
  if (
    memoryCache &&
    Date.now() - memoryCacheTime < CACHE_DURATION
  ) {
    return memoryCache;
  }

  const errors: string[] = [];

  for (const year of [CURRENT_YEAR, CURRENT_YEAR - 1]) {
    try {
      const result = await downloadAndProcess(year);

      memoryCache = result;
      memoryCacheTime = Date.now();

      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown data error";

      errors.push(`${year}: ${message}`);
      console.error(`NFL data error for ${year}:`, message);
    }
  }

  throw new Error(
    "NFL statistics could not be loaded. " +
    errors.join(" | ")
  );
}

function publicPlayer(player: PlayerStats) {
  return {
    ...player,
    games: player.weeks.length
  };
}

function buildNFLContext(
  data: LoadedStats,
  question: string
): string {
  const normalizedQuestion = normalize(question);

  const selected = new Set<PlayerStats>();

  const matched = data.players.filter(player =>
    normalizedQuestion.includes(normalize(player.name))
  );

  matched.slice(0, 10).forEach(player => selected.add(player));

  for (const category of STAT_CATEGORIES) {
    const leaders = [...data.players]
      .filter(player => player[category.key] > 0)
      .sort(
        (a, b) =>
          b[category.key] - a[category.key]
      )
      .slice(0, 5);

    leaders.forEach(player => selected.add(player));
  }

  const formatPlayer = (player: PlayerStats) => [
    `${player.name} (${player.position || "Position unavailable"})`,
    `Teams: ${player.teams.join(", ") || "Unavailable"}`,
    `Weeks recorded: ${player.weeks.length}`,
    `Passing: ${player.passing_yards} yards, ${player.passing_tds} TD, ${player.interceptions} INT`,
    `Rushing: ${player.rushing_yards} yards, ${player.rushing_tds} TD, ${player.carries} carries`,
    `Receiving: ${player.receptions} receptions, ${player.receiving_yards} yards, ${player.receiving_tds} TD, ${player.targets} targets`
  ].join(" | ");

  const leaderboards = STAT_CATEGORIES.map(category => {
    const leaders = [...data.players]
      .filter(player => player[category.key] > 0)
      .sort(
        (a, b) =>
          b[category.key] - a[category.key]
      )
      .slice(0, 5);

    return (
      category.label +
      ": " +
      leaders
        .map(
          (player, index) =>
            `${index + 1}. ${player.name} (${player[category.key]})`
        )
        .join("; ")
    );
  });

  return `
VERIFIED NFL DATA CONTEXT

Source: nflverse
Statistics season: ${data.season}
Current calendar year: ${CURRENT_YEAR}
Season type: Regular season
Retrieved: ${data.retrievedAt}
Source file: ${data.sourceUrl}

${
  data.isCurrentSeason
    ? "Current-season statistics were successfully retrieved."
    : "WARNING: These are previous-season statistics, NOT current-season statistics."
}

PLAYER RECORDS:

${Array.from(selected).map(formatPlayer).join("\n")}

LEADERBOARDS:

${leaderboards.join("\n")}

IMPORTANT:
- Only use the supplied numbers as verified statistics.
- Never call previous-season statistics current-season statistics.
- These statistics come from weekly nflverse data.
- The current season may be incomplete.
- Do not invent statistics for players not listed.
`;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/" ||
      !url.pathname.startsWith("/api/")
    ) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405
        });
      }

      return handleChatRequest(request, env);
    }

    if (url.pathname === "/api/nfl/status") {
      try {
        const data = await loadPlayerStats();

        return Response.json({
          status: "available",
          source: "nflverse",
          season: data.season,
          isCurrentSeason: data.isCurrentSeason,
          playerCount: data.players.length,
          retrievedAt: data.retrievedAt,
          sourceUrl: data.sourceUrl
        });
      } catch (error) {
        return Response.json(
          {
            status: "unavailable",
            source: "nflverse",
            seasonAttempted: CURRENT_YEAR,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error"
          },
          { status: 503 }
        );
      }
    }

    if (url.pathname === "/api/nfl/players") {
      try {
        const data = await loadPlayerStats();

        const search = normalize(
          url.searchParams.get("search") || ""
        );

        const results = data.players
          .filter(player => {
            if (!search) return true;

            return (
              normalize(player.name).includes(search) ||
              normalize(player.position).includes(search) ||
              player.teams.some(team =>
                normalize(team).includes(search)
              )
            );
          })
          .slice(0, 50)
          .map(publicPlayer);

        return Response.json({
          season: data.season,
          isCurrentSeason: data.isCurrentSeason,
          count: results.length,
          players: results
        });
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Statistics unavailable"
          },
          { status: 503 }
        );
      }
    }

    if (url.pathname === "/api/nfl/leaders") {
      try {
        const data = await loadPlayerStats();

        const requestedStat =
          url.searchParams.get("stat") || "passing_yards";

        const category = STAT_CATEGORIES.find(
          item => item.key === requestedStat
        );

        if (!category) {
          return Response.json(
            {
              error: "Invalid statistic requested.",
              availableStatistics: STAT_CATEGORIES.map(
                item => item.key
              )
            },
            { status: 400 }
          );
        }

        const requestedLimit = Number(
          url.searchParams.get("limit") || 10
        );

        const limit = Math.max(
          1,
          Math.min(
            Number.isFinite(requestedLimit)
              ? requestedLimit
              : 10,
            50
          )
        );

        const leaders = [...data.players]
          .filter(player => player[category.key] > 0)
          .sort(
            (a, b) =>
              b[category.key] - a[category.key]
          )
          .slice(0, limit)
          .map(player => ({
            ...publicPlayer(player),
            value: player[category.key]
          }));

        return Response.json({
          season: data.season,
          statistic: category.key,
          leaders
        });
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Statistics unavailable"
          },
          { status: 503 }
        );
      }
    }

    return new Response("Not found", {
      status: 404
    });
  }
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
    };

    const messages: ChatMessage[] =
      Array.isArray(body.messages)
        ? body.messages
        : [];

    if (messages.length === 0) {
      return Response.json(
        { error: "Please send a message." },
        { status: 400 }
      );
    }

    const latestQuestion = [...messages]
      .reverse()
      .find(message => message.role === "user")
      ?.content || "";

    let nflContext = "";

    try {
      const data = await loadPlayerStats();

      nflContext = buildNFLContext(
        data,
        latestQuestion
      );
    } catch (error) {
      console.error("NFL statistics unavailable:", error);

      nflContext = `
NFL STATISTICS WARNING:

Verified nflverse statistics could not be retrieved.

Do not guess or invent current NFL statistics.
Do not use outdated statistics as current statistics.
Tell the user that verified statistics are temporarily unavailable.
You may still answer general football strategy questions.
`;
    }

    const conversationMessages = messages.filter(
      message => message.role !== "system"
    );

    conversationMessages.unshift({
      role: "system",
      content: SYSTEM_PROMPT + "\n\n" + nflContext
    });

    const inputs = {
      messages: conversationMessages,
      max_tokens: 1800,
      stream: true
    } satisfies AiTextGenerationInput & {
      stream: true
    };

    const stream = await env.AI.run<typeof MODEL_ID>(
      MODEL_ID,
      inputs
    );

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    console.error("Error processing chat request:", error);

    return Response.json(
      {
        error: "Failed to process request"
      },
      { status: 500 }
    );
  }
}
