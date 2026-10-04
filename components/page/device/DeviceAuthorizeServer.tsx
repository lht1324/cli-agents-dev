import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import DeviceAuthorizeClient from "./DeviceAuthorizeClient";

export default async function DeviceAuthorizeServer({ params }: { params: Record<string, string | undefined> }) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
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
