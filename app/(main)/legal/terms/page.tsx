import type { Metadata } from "next";
import TermsPageServer from "@/components/page/legal/TermsPageServer";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "The rules for using LocalAgents.",
};

export default function TermsPage() {
    return <TermsPageServer />;
}
