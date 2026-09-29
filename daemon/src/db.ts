import { neon } from "@neondatabase/serverless";

type Db = ReturnType<typeof neon>;

let client: Db | null = null;

// Neon 직결 클라이언트. 마이그레이션된 dev/prod URL을 쓴다.
export function db(): Db {
    if (client) {
        return client;
    }
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL is not set");
    }
    client = neon(url);
    return client;
}
