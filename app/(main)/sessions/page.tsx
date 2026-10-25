import SessionsPageServer from "@/components/page/sessions/SessionsPageServer";

export default function SessionsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>;
}) {
    return <SessionsPageServer searchParams={searchParams} />;
}
