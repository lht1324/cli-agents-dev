function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}

function appEnv(): "development" | "production" | "test" {
    const value = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
    if (value === "production" || value === "test" || value === "development") {
        return value;
    }
    throw new Error(`APP_ENV must be development, production, or test (got: ${value})`);
}

export const env = {
    databaseUrl: () => required("DATABASE_URL"),
    neonApiKey: () => required("NEON_API_KEY"),
    neonProjectId: () => required("NEON_PROJECT_ID"),
    neonBranchId: () => required("NEON_BRANCH_ID"),
    authBaseUrl: () => required("NEON_AUTH_BASE_URL"),
    authCookieSecret: () => required("NEON_AUTH_COOKIE_SECRET"),
    appEnv: () => appEnv(),
    isDev: () => appEnv() === "development",
    isProd: () => appEnv() === "production",
};
