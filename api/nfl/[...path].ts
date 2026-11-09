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
 * Vercel Node.js function adapter.
 * Keeps the existing nflverse API logic while replacing Cloudflare's
 * request runtime with Vercel's standard Request/Response interface.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const env = {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 })
      }
    };

    const context = {
      waitUntil: (_promise: Promise<unknown>) => undefined,
      passThroughOnException: () => undefined
    };

    return nflWorker.fetch(request, env, context);
  }
};
