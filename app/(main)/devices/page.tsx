import type { Metadata } from "next";
import DevicesPageServer from "@/components/page/devices/DevicesPageServer";
import { NOINDEX_METADATA } from "@/lib/site";

export const metadata: Metadata = NOINDEX_METADATA;

export default function DevicesPage() {
    return <DevicesPageServer />;
}
