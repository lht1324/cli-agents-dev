import Link from "next/link";
import BrandMark from "@/components/public/BrandMark";

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
