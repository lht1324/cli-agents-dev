import type { Metadata } from "next";
import RefundsPageServer from "@/components/page/legal/RefundsPageServer";
import { buildPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
    title: "Refund Policy",
    description: "Cancel anytime. Unused days refunded pro rata within 14 days.",
    path: "/legal/refunds",
});

export default function RefundsPage() {
    return <RefundsPageServer />;
}
