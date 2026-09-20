import { loadEnvConfig } from "@next/env"

// Loads .env files the way Next.js does, for tooling that runs outside the Next
// runtime (drizzle-kit, vitest). The second argument is Next's own `dev` flag:
// without it @next/env resolves "production" mode and would prefer
// .env.production* over .env. Import this before any module that reads
// process.env at import time.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")
