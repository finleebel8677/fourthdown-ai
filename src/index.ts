import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const CURRENT_YEAR = new Date().getUTCFullYear();

const SYSTEM_PROMPT = `
You are FOURTHDOWN AI, an expert NFL football analyst.

You analyze NFL players, teams, statistics, schemes, matchups and strategy.

STATISTICS RULES:
- Always prioritize the VERIFIED NFL DATA CONTEXT supplied with the request.
- Never invent statistics, rankings, records, injuries or game results.
- Always identify the season associated with statistics.
- Never describe previous-season statistics as current-season statistics.
- If verified statistics are unavailable, say so clearly.
- Distinguish actual statistics from predictions and opinions.
- Explain football analysis in detail.
- Identify nflverse as the source of supplied statistics.
- Do not pretend to have live NFL tracking data or live game information.
`;

interface PlayerStats {
    id: string;
    name: string;
    position: string;
    teams: Set<string>;
    weeks: Set<number>;
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

const STAT_CATEGORIES = [
    { label: "Passing yards", key: "passing_yards" },
    { label: "Passing touchdowns", key: "passing_tds" },
    { label: "Rushing yards", key: "rushing_yards" },
    { label: "Rushing touchdowns", key: "rushing_tds" },
    { label: "Receiving yards", key: "receiving_yards" },
    { label: "Receiving touchdowns", key: "receiving_tds" },
    { label: "Receptions", key: "receptions" },
    { label: "Interceptions", key: "interceptions" }
] as const;

function dataUrl(year: number): string {
    return `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${year}.csv`;
}

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
    if (!value || value === "NA" || value === "null") {
        return 0;
    }

    const number = Number(value.replace(/,/g, ""));
    return Number.isFinite(number) ? number : 0;
}

async function downloadCsv(year: number): Promise<string> {
    const url = dataUrl(year);
    const cache = (globalThis as any).caches?.default;
    const cacheKey = new Request(url);

    if (cache) {
        const cached = await cache.match(cacheKey);

        if (cached) {
            const cachedText = await cached.text();

            if (
                cachedText.length > 100 &&
                !cachedText.trimStart().startsWith("<")
            ) {
                return cachedText;
            }
        }
    }

    // Do not add a custom User-Agent header.
    // Cloudflare Workers restrict certain request headers.
    const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
            "Accept": "text/csv"
        }
    });

    if (!response.ok) {
        throw new Error(
            `nflverse returned HTTP ${response.status} for season ${year}`
        );
    }

    const csv = await response.text();

    if (
        csv.length < 100 ||
        csv.trimStart().startsWith("<") ||
        !csv.includes("player_name")
    ) {
        throw new Error("The NFL statistics download was not a valid CSV.");
    }

    if (cache) {
        await cache.put(
            cacheKey,
            new Response(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Cache-Control": "public, max-age=900"
                }
            })
        );
    }

    return csv;
}

function processCsv(csv: string, year: number): PlayerStats[] {
    const lines = csv.split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
        throw new Error("The NFL statistics file contains no player records.");
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
        column("recent_team") >= 0
            ? column("recent_team")
            : column("team");

    const weekColumn = column("week");
    const seasonColumn = column("season");
    const seasonTypeColumn = column("season_type");

    if (nameColumn < 0) {
        throw new Error("Player names are missing from the data.");
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
        targets: column("targets")
    };

    const players = new Map<string, PlayerStats>();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);

        if (
            seasonColumn >= 0 &&
            numberValue(row[seasonColumn]) !== year
        ) {
            continue;
        }

        if (
            seasonTypeColumn >= 0 &&
            row[seasonTypeColumn] !== "REG"
        ) {
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
                id,
                name,
                position:
                    positionColumn >= 0
                        ? row[positionColumn] || ""
                        : "",
                teams: new Set<string>(),
                weeks: new Set<number>(),
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

        if (teamColumn >= 0 && row[teamColumn]) {
            player.teams.add(row[teamColumn]);
        }

        if (weekColumn >= 0) {
            const week = numberValue(row[weekColumn]);

            if (week > 0) {
                player.weeks.add(week);
            }
        }

        for (
            const key of Object.keys(statColumns) as Array<
                keyof typeof statColumns
            >
        ) {
            const index = statColumns[key];

            if (index >= 0) {
                player[key] += numberValue(row[index]);
            }
        }
    }

    if (players.size === 0) {
        throw new Error("No player statistics were found.");
    }

    return Array.from(players.values());
}

async function loadPlayerStats(): Promise<LoadedStats> {
    const errors: string[] = [];

    // Try this season first. The previous season is only a fallback.
    for (const year of [CURRENT_YEAR, CURRENT_YEAR - 1]) {
        try {
            const csv = await downloadCsv(year);
            const players = processCsv(csv, year);

            return {
                players,
                season: year,
                isCurrentSeason: year === CURRENT_YEAR,
                retrievedAt: new Date().toISOString(),
                sourceUrl: dataUrl(year)
            };
        } catch (error) {
            errors.push(
                `${year}: ${
                    error instanceof Error
                        ? error.message
                        : "Unknown download error"
                }`
            );
        }
    }

    throw new Error(
        "Unable to retrieve current or previous-season NFL statistics. " +
        errors.join(" | ")
    );
}

function normalize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

function buildNFLContext(
    data: LoadedStats,
    question: string
): string {
    const normalizedQuestion = normalize(question);

    const matched = data.players.filter(player => {
        const name = normalize(player.name);

        return (
            name.length > 2 &&
            normalizedQuestion.includes(name)
        );
    });

    const selected = new Set<PlayerStats>(matched.slice(0, 8));

    // Add leaders in major statistical categories.
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

    const formatPlayer = (player: PlayerStats) => {
        return [
            `${player.name} (${player.position || "Position unavailable"})`,
            `Teams: ${Array.from(player.teams).join(", ") || "Unavailable"}`,
            `Games/weeks recorded: ${player.weeks.size}`,
            `Passing: ${player.passing_yards} yards, ${player.passing_tds} TD, ${player.interceptions} INT`,
            `Rushing: ${player.rushing_yards} yards, ${player.rushing_tds} TD, ${player.carries} carries`,
            `Receiving: ${player.receptions} receptions, ${player.receiving_yards} yards, ${player.receiving_tds} TD, ${player.targets} targets`
        ].join(" | ");
    };

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
Source URL: ${data.sourceUrl}

Statistics season: ${data.season}
Current calendar year: ${CURRENT_YEAR}
Season type: Regular season
Retrieved: ${data.retrievedAt}

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
- These statistics are based on weekly nflverse data.
- Data may not include games that have not yet been processed.
- If a player is not listed, do not invent their statistics.
`;
}

function publicPlayer(player: PlayerStats) {
    return {
        id: player.id,
        name: player.name,
        position: player.position,
        teams: Array.from(player.teams),
        games: player.weeks.size,
        passing_yards: player.passing_yards,
        passing_tds: player.passing_tds,
        interceptions: player.interceptions,
        rushing_yards: player.rushing_yards,
        rushing_tds: player.rushing_tds,
        carries: player.carries,
        receiving_yards: player.receiving_yards,
        receiving_tds: player.receiving_tds,
        receptions: player.receptions,
        targets: player.targets
    };
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);

        // Frontend files
        if (
            url.pathname === "/" ||
            !url.pathname.startsWith("/api/")
        ) {
            return env.ASSETS.fetch(request);
        }

        // Chat endpoint
        if (url.pathname === "/api/chat") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", {
                    status: 405
                });
            }

            return handleChatRequest(request, env);
        }

        // Actual statistics connection test
        if (url.pathname === "/api/nfl/status") {
            if (request.method !== "GET") {
                return new Response("Method not allowed", {
                    status: 405
                });
            }

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

        // Player search endpoint
        if (url.pathname === "/api/nfl/players") {
            if (request.method !== "GET") {
                return new Response("Method not allowed", {
                    status: 405
                });
            }

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
                            Array.from(player.teams).some(team =>
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

        // Statistical leaderboard endpoint
        if (url.pathname === "/api/nfl/leaders") {
            if (request.method !== "GET") {
                return new Response("Method not allowed", {
                    status: 405
                });
            }

            try {
                const data = await loadPlayerStats();

                const requestedStat =
                    url.searchParams.get("stat") || "passing_yards";

                const validStat = STAT_CATEGORIES.find(
                    category => category.key === requestedStat
                );

                if (!validStat) {
                    return Response.json(
                        {
                            error: "Invalid statistic requested.",
                            availableStatistics: STAT_CATEGORIES.map(
                                category => category.key
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
                    .sort(
                        (a, b) =>
                            b[validStat.key] - a[validStat.key]
                    )
                    .filter(player => player[validStat.key] > 0)
                    .slice(0, limit)
                    .map(player => ({
                        ...publicPlayer(player),
                        value: player[validStat.key]
                    }));

                return Response.json({
                    season: data.season,
                    statistic: validStat.key,
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

        return new Response("Not found", { status: 404 });
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
            console.error(
                "NFL statistics unavailable:",
                error
            );

            nflContext = `
NFL STATISTICS WARNING:

The verified nflverse statistics feed could not be retrieved.

Do not guess or invent current NFL statistics.
Do not use outdated statistics as current statistics.

Tell the user that verified statistics are temporarily unavailable.
You may still answer general football strategy questions.
`;
        }

        // Remove old system messages and add our current instructions.
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
        console.error(
            "Error processing chat request:",
            error
        );

        return Response.json(
            {
                error: "Failed to process request"
            },
            { status: 500 }
        );
    }
}
