import type { Metadata } from "next";
import ProfilePageServer from "@/components/page/profile/ProfilePageServer";
import { NOINDEX_METADATA } from "@/lib/site";

export const metadata: Metadata = NOINDEX_METADATA;

export default function ProfilePage() {
    return <ProfilePageServer />;
}
