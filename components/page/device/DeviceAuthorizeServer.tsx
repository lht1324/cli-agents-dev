import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { unsealConnect } from "@/lib/auth/packet";
import DeviceAuthorizeClient from "./DeviceAuthorizeClient";

export default async function DeviceAuthorizeServer({ params }: { params: Record<string, string | undefined> }) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        const query = new URLSearchParams(
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]),
        ).toString();
        redirect(`/api/device/begin?${query}`);
    }
    // 봉투 우선. 코드는 복호화 뒤 파싱해서 쓴다. URL에는 암호문만 남는다.
    const data = params.data;
    const p = data ? unsealConnect(data) : null;
    const deviceId = p?.device ?? params.device ?? "";
    const port = p?.port ?? params.port ?? "";
    const state = p?.state ?? params.state ?? "";
    if (!deviceId || !port || !state) {
        redirect("/");
    }
    return (
        <DeviceAuthorizeClient
            deviceId={deviceId}
            port={port}
            state={state}
            label={p?.label ?? params.label ?? ""}
            platform={p?.platform ?? params.platform ?? ""}
            hostname={p?.hostname ?? params.hostname ?? ""}
        />
    );
}
