const privateHeaders = { "Cache-Control": "no-store" };
const maxRequests = 16;
let activeRequests = 0;
class BodyLimitError extends Error {}

// Enforce byte limits while reading, including chunked bodies without Content-Length.
async function boundedJson(source: Pick<Request, "body" | "headers">, limit: number, signal: AbortSignal) {
  if (Number(source.headers.get("content-length")) > limit) {
    void source.body?.cancel().catch(() => {});
    throw new BodyLimitError();
  }
  if (!source.body) throw new SyntaxError("Missing body");
  const reader = source.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new BodyLimitError();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    signal.removeEventListener("abort", abort);
    // Do not wait for an untrusted sender to finish its stream after rejecting it.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
const validPoint = (point: unknown): point is [number, number] => Array.isArray(point) && point.length === 2
  && point.every((value) => typeof value === "number" && Number.isFinite(value))
  && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;

/** Geometry only: no account tokens, names or ride identifiers are sent to the router. */
export async function POST(request: Request) {
  if (activeRequests >= maxRequests)
    return Response.json({ error: "Road route busy" }, { status: 503, headers: { ...privateHeaders, "Retry-After": "2" } });
  activeRequests++;
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(6000)]);
    let input;
    try { input = await boundedJson(request, 512, signal); }
    catch (error) { return Response.json({ error: "Invalid coordinates" }, { status: error instanceof BodyLimitError ? 413 : 400, headers: privateHeaders }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders });
    const { from, to } = input;
    if (!validPoint(from) || !validPoint(to)) return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders });
    const router = (process.env.RIDE_ROUTER_URL || "https://router.project-osrm.org").replace(/\/$/, "");
    const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    const response = await fetch(`${router}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
      signal, redirect: "error", cache: "no-store", headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Router unavailable");
    }
    const body = await boundedJson(response, 2_000_000, signal);
    const route = body.code === "Ok" && body.routes?.[0];
    const points = route?.geometry?.coordinates;
    if (!Array.isArray(points) || points.length < 2 || points.length > 20000
      || !points.every((p) => Array.isArray(p) && p.length === 2 && validPoint([p[1], p[0]]))
      || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0) throw new Error("No route");
    return Response.json({ points: points.map(([lng, lat]) => [lat, lng]), distance: route.distance, duration: route.duration }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Road route unavailable" }, { status: 503, headers: privateHeaders });
  } finally {
    activeRequests--;
  }
}
