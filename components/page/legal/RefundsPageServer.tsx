import LegalPageClient from "./LegalPageClient";

export default function RefundsPageServer() {
    // 공개 문서: 인증·결제 게이트 없음.
    return <LegalPageClient kind="refunds" />;
}
