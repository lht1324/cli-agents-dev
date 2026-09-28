import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "../env";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

// 패키지로 떼어낼 때 그대로 가져가는 팩토리. process.env를 직접 읽지 않는다.
export function createNeonClient(connectionString: string) {
    const sql = neon(connectionString);
    return drizzle(sql, { schema });
}

// 앱에서 쓰는 싱글톤. DATABASE_URL 필요.
export function getDb() {
    if (cached) {
        return cached;
    }
    const url = env.databaseUrl();
    cached = createNeonClient(url);
    return cached;
}

export type Db = ReturnType<typeof createNeonClient>;
