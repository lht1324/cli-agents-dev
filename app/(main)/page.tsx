import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPageServer from "@/components/page/landing/LandingPageServer";
import { buildPageMetadata, SITE_DESCRIPTION, SITE_TITLE, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
});

// 구조화 데이터. 가격은 랜딩에 실제로 보이는 값과 같아야 한다 (다르면 스팸 신호).
const JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
        },
        {
            "@type": "SoftwareApplication",
            name: SITE_NAME,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "macOS, Linux",
            description: SITE_DESCRIPTION,
            url: SITE_URL,
            offers: [
                { "@type": "Offer", name: "Pro Monthly", price: "9", priceCurrency: "USD" },
                { "@type": "Offer", name: "Pro Annual", price: "90", priceCurrency: "USD" },
            ],
        },
    ],
};

export default async function HomePage() {
    const jar = await cookies();
    const back = jar.get("localagents_connect")?.value;
    if (back && back.startsWith("/device/authorize?")) {
        redirect("/api/device/consume");
    }
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
            />
            <LandingPageServer />
        </>
    );
}
