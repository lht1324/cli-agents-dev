import "dotenv/config";
import type { Config } from "drizzle-kit";
import { env } from "./lib/env";

export default {
    schema: "./lib/neon/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: env.databaseUrl(),
    },
} satisfies Config;
