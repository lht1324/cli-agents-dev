import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LandingPageServer from "@/components/page/landing/LandingPageServer";

export default async function HomePage() {
    const jar = await cookies();
    const back = jar.get("cliagent_connect")?.value;
    if (back && back.startsWith("/device/authorize?")) {
        jar.delete("cliagent_connect");
        redirect(back);
    }
    return <LandingPageServer />;
}
