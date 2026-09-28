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
    authBaseUrl: () => required("NEON_AUTH_BASE_URL"),
    authCookieSecret: () => required("NEON_AUTH_COOKIE_SECRET"),
    appEnv: () => appEnv(),
    isDev: () => appEnv() === "development",
    isProd: () => appEnv() === "production",
};
