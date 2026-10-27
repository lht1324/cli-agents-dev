import type { Metadata } from "next";
import PrivacyPageServer from "@/components/page/legal/PrivacyPageServer";
import { buildPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
    title: "Privacy Policy",
    description: "What LocalAgents collects, why, and who processes it.",
    path: "/legal/privacy",
});

export default function PrivacyPage() {
    return <PrivacyPageServer />;
}
