// Cria/atualiza o schema `followcatch` (idempotente). Uso: npx tsx server/migrate.ts
// O app também roda isso sozinho no 1º acesso ao banco.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });
const { migrate, q } = await import("./db.js");
await migrate();
const t = await q<{ table_name: string }>(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'followcatch' ORDER BY 1",
);
console.log("followcatch:", t.map((r) => r.table_name).join(", "));
process.exit(0);
