import type { Metadata } from "next";
import TermsPageServer from "@/components/page/legal/TermsPageServer";
import { buildPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
    title: "Terms of Service",
    description: "The rules for using LocalAgents.",
    path: "/legal/terms",
});

export default function TermsPage() {
    return <TermsPageServer />;
}
