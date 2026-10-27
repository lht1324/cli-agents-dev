import dotenv from "dotenv";
import type { Config } from "drizzle-kit";
import { env } from "./lib/env";

// dotenv/config는 .env만 읽는다. 실값이 있는 .env.local을 먼저 읽는다.
dotenv.config({ path: ".env.local" });
dotenv.config();

export default {
    schema: "./lib/neon/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: env.databaseUrl(),
    },
} satisfies Config;
