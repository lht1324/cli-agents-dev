import SessionDetailServer from "@/components/page/sessions/SessionDetailServer";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SessionDetailServer id={id} />;
}
