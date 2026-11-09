import worker from "../../src/index";

type WorkerLike = {
  fetch: (
    request: Request,
    env: unknown,
    context: unknown
  ) => Promise<Response>;
};

const nflWorker = worker as unknown as WorkerLike;

/**
 * Vercel Node.js API handler.
 * Adapts Vercel's (req, res) interface to the existing Fetch-based NFL API.
 */
export default async function handler(req: any, res: any): Promise<void> {
  try {
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || "https";
    const host = req.headers.host || "localhost";
    const request = new Request(`${protocol}://${host}${req.url || "/"}`);

    const env = {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 })
      }
    };

    const context = {
      waitUntil: (_promise: Promise<unknown>) => undefined,
      passThroughOnException: () => undefined
    };

    const response = await nflWorker.fetch(request, env, context);
    res.statusCode = response.status;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.end(new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    console.error("GRIDIRON IQ API error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      status: "error",
      error: error instanceof Error ? error.message : "Internal server error"
    }));
  }
}
