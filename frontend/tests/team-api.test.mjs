import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import team from "../team-api.json" with { type: "json" };

test("a frontend clone accepts the team's database and stops on a different one", async t => {
  let storageId = team.storageId;
  const paths = [];
  const server = createServer((req, res) => {
    paths.push(req.url);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/backend/api/sync/status") res.end(JSON.stringify({ status: "ok", storageId }));
    else if (req.url === "/backend/api/merchants/offers") res.end("[]");
    else { res.writeHead(401); res.end(); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const script = fileURLToPath(new URL("../scripts/check-shared-api.mjs", import.meta.url));
  const check = () => promisify(execFile)(process.execPath, [script, "--team", `http://127.0.0.1:${server.address().port}/backend/`]);
  assert.ok((await check()).stdout.includes(team.storageId));
  assert.deepEqual(paths.sort(), ["/backend/api/account-data", "/backend/api/merchants/offers", "/backend/api/sync/status"]);
  paths.length = 0;
  storageId = "00000000-0000-4000-a000-000000000000";
  await assert.rejects(check, error => error.code === 1 && error.stderr.includes("Different database"));
  assert.deepEqual(paths, ["/backend/api/sync/status"]);
});
