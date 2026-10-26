import LegalPageClient from "./LegalPageClient";

export default function TermsPageServer() {
    // 공개 문서: 인증·결제 게이트 없음. 법률 문서 검색엔진 노출이 목적.
    return <LegalPageClient kind="terms" />;
}
