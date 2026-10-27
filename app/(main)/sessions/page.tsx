import type { Metadata } from "next";
import SessionsPageServer from "@/components/page/sessions/SessionsPageServer";
import { NOINDEX_METADATA } from "@/lib/site";

export const metadata: Metadata = NOINDEX_METADATA;

export default function SessionsPage() {
    return <SessionsPageServer />;
}
