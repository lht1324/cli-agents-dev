import type { Metadata } from "next";
import PrivacyPageServer from "@/components/page/legal/PrivacyPageServer";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "What LocalAgents collects, why, and who processes it.",
};

export default function PrivacyPage() {
    return <PrivacyPageServer />;
}
