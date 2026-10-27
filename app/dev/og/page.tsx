import type { Metadata } from "next";
import OgCardPageClient from "@/components/page/dev/OgCardPageClient";

// 개발 전용 — OG 카드 프리뷰·캡처. prod에도 배포되지만 noindex라 검색에 잡히지 않는다.
export const metadata: Metadata = {
    title: "OG card",
    robots: {
        index: false,
        follow: false,
    },
};

export default function OgCardPage() {
    return <OgCardPageClient />;
}
