import type { Metadata } from "next";
import DeviceAuthorizeServer from "@/components/page/device/DeviceAuthorizeServer";
import { NOINDEX_METADATA } from "@/lib/site";

export const metadata: Metadata = NOINDEX_METADATA;

export default async function DeviceAuthorizePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>;
}) {
    const params = await searchParams;
    return <DeviceAuthorizeServer params={params} />;
}
