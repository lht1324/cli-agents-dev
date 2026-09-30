import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { devices, getDb } from "@/lib/neon";
import DevicesPageClient, { type DeviceRow } from "./DevicesPageClient";

export default async function DevicesPageServer() {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }
    const db = getDb();
    const rows = await db
        .select({
            id: devices.id,
            label: devices.label,
            platform: devices.platform,
            hostname: devices.hostname,
            lastSeenAt: devices.lastSeenAt,
        })
        .from(devices)
        .where(eq(devices.userId, session.user.id));
    const items: DeviceRow[] = rows.map((r) => ({
        ...r,
        lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    }));
    return <DevicesPageClient items={items} />;
}
