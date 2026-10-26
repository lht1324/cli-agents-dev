import type { Metadata } from "next";
import RefundsPageServer from "@/components/page/legal/RefundsPageServer";

export const metadata: Metadata = {
    title: "Refund Policy",
    description: "Cancel anytime. Unused days refunded pro rata within 14 days.",
};

export default function RefundsPage() {
    return <RefundsPageServer />;
}
