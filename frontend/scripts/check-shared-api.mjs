import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import team from "../team-api.json" with { type: "json" };

const args = process.argv.slice(2);
const teamMode = args.includes("--team");
const [override, ...extra] = args.filter(arg => !["--team", "--dev"].includes(arg));

async function check(api, expectedId) {
  const get = path => fetch(api + path, { signal: AbortSignal.timeout(12000), redirect: "error" });
  const response = await get("/api/sync/status");
  if (!response.ok) throw new Error(`Database status returned HTTP ${response.status}.`);
  const status = await response.json();
  if (status.status !== "ok" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(status.storageId))
    throw new Error("This address did not return a Grab database identity.");
  if (expectedId && status.storageId.toLowerCase() !== expectedId.toLowerCase())
    throw new Error(`Different database. Expected ${expectedId}, got ${status.storageId}.`);
  const [offers, account] = await Promise.all([get("/api/merchants/offers"), get("/api/account-data")]);
  if (!offers.ok || !Array.isArray(await offers.json()) || account.status !== 401)
    throw new Error("The catalogue or private account endpoint failed its readiness check.");
  console.log(`API: ${api}\nStorage ID: ${status.storageId}`);
}

try {
  if (extra.length || override?.startsWith("--")) throw new Error("Supply a single API base URL, including /backend when using the website.");
  const directApi = process.env.NEXT_PUBLIC_API_URL;
  const configuredApi = directApi && directApi !== "/backend" ? directApi : process.env.API_PROXY_URL;
  const url = new URL(override ?? (teamMode ? team.apiUrl : configuredApi || "http://localhost:5000"));
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Use an HTTP(S) API base URL without credentials, query or fragment.");
  const api = url.href.replace(/\/+$/, "");
  await check(api, teamMode ? team.storageId : undefined);
  if (args.includes("--dev")) {
    // Next gives process variables precedence over .env files. Team sessions
    // always proxy through the verified server, including with older .env.local files.
    const require = createRequire(import.meta.url);
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev"], {
      stdio: "inherit",
      env: { ...process.env, API_PROXY_URL: api, NEXT_PUBLIC_API_URL: "/backend", NEXT_PUBLIC_ENABLE_DEMO_RIDES: "false" },
    });
    child.on("error", error => { console.error(error.message); process.exitCode = 1; });
    child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 0 : 1); });
  } else console.log("Shared API is ready. Compare the Storage ID on each computer.");
} catch (error) {
  console.error(`Shared API check failed: ${error.message}\nCheck the host is running and use its API base URL (the shared website URL followed by /backend).`);
  process.exitCode = 1;
}
