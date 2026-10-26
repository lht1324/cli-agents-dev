import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/public/BrandMark";
import { NOINDEX_METADATA } from "@/lib/site";

// 인증 화면은 색인 대상이 아니다. 라우트 전체에 한 번만 선언한다.
export const metadata: Metadata = NOINDEX_METADATA;

// 인증 화면 헤더는 워드마크만. 익명 상태라 Sessions/Devices도, Sign in 버튼도 문맥상 잡음.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <header className="border-b border-line">
                <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
                    <Link href="/" className="flex items-center gap-2 font-mono font-bold">
                        <BrandMark size={24} />
                        localagents
                    </Link>
                </div>
            </header>
            {children}
        </>
    );
}
