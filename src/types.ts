/** Environment bindings for the GRIDIRON IQ NFL analytics worker. */
export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}
