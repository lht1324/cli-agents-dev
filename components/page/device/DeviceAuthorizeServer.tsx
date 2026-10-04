import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/server";
import DeviceAuthorizeClient from "./DeviceAuthorizeClient";

export default async function DeviceAuthorizeServer({ params }: { params: Record<string, string | undefined> }) {
    const { data: session } = await auth.getSession();
    const back = `/device/authorize?${new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]),
    ).toString()}`;
    if (!session?.user) {
        const jar = await cookies();
    jar.set("cliagent_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(back)}`);
    }
    const deviceId = params.device ?? "";
    const port = params.port ?? "";
    const state = params.state ?? "";
    if (!deviceId || !port || !state) {
        redirect("/");
    }
    return (
        <DeviceAuthorizeClient
            deviceId={deviceId}
            port={port}
            state={state}
            label={params.label ?? ""}
            platform={params.platform ?? ""}
            hostname={params.hostname ?? ""}
        />
    );
}
