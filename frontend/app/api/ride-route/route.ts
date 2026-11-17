const privateHeaders = { "Cache-Control": "no-store" };
const validPoint = (point: unknown): point is [number, number] => Array.isArray(point) && point.length === 2
  && point.every((value) => typeof value === "number" && Number.isFinite(value))
  && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;

/** Geometry only: no account tokens, names or ride identifiers are sent to the router. */
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 512) return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders });
    let input;
    try { input = JSON.parse(text); }
    catch { return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders });
    const { from, to } = input;
    if (!validPoint(from) || !validPoint(to)) return Response.json({ error: "Invalid coordinates" }, { status: 400, headers: privateHeaders });
    const router = (process.env.RIDE_ROUTER_URL || "https://router.project-osrm.org").replace(/\/$/, "");
    const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    const response = await fetch(`${router}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(6000)]), cache: "no-store", headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Router unavailable");
    const body = await response.json();
    const route = body.code === "Ok" && body.routes?.[0];
    const points = route?.geometry?.coordinates;
    if (!Array.isArray(points) || points.length < 2 || points.length > 20000
      || !points.every((p) => Array.isArray(p) && p.length === 2 && validPoint([p[1], p[0]]))
      || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0) throw new Error("No route");
    return Response.json({ points: points.map(([lng, lat]) => [lat, lng]), distance: route.distance, duration: route.duration }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Road route unavailable" }, { status: 503, headers: privateHeaders });
  }
}
