import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPageServer from "@/components/page/landing/LandingPageServer";

export default async function HomePage() {
    const jar = await cookies();
    const back = jar.get("agentgit_connect")?.value;
    if (back && back.startsWith("/device/authorize?")) {
        redirect("/api/device/consume");
    }
    return <LandingPageServer />;
}
