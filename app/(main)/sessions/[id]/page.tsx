import type { Metadata } from "next";
import SessionDetailServer from "@/components/page/sessions/SessionDetailServer";
import { NOINDEX_METADATA } from "@/lib/site";

export const metadata: Metadata = NOINDEX_METADATA;

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SessionDetailServer id={id} />;
}
