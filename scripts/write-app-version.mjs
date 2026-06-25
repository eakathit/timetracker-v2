import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev";

const payload = {
  version,
  builtAt: new Date().toISOString(),
};

const target = path.join(__dirname, "..", "public", "app-version.json");
fs.writeFileSync(target, `${JSON.stringify(payload)}\n`);
