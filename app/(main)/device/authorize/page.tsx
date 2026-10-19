import DeviceAuthorizeServer from "@/components/page/device/DeviceAuthorizeServer";

export default async function DeviceAuthorizePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>;
}) {
    const params = await searchParams;
    return <DeviceAuthorizeServer params={params} />;
}
