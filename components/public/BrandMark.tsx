import { memo } from "react";

interface BrandMarkProps {
    /** 표시 크기(px). SVG라 임의 크기에서 선명하다. */
    size?: number;
    className?: string;
}

// 브랜드 마크. next/image 옵티마이저가 작은 크기에서 리샘플(q75)해 뭉개므로 원본 SVG를 직접 로드한다.
// 워드마크 옆에 붙는 장식이라 alt는 비워 둔다 (링크 텍스트가 이름을 이미 전달).
function BrandMark({ size = 24, className = "" }: BrandMarkProps) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src="/logo/logo.svg"
            alt=""
            aria-hidden="true"
            width={size}
            height={size}
            className={className}
        />
    );
}

export default memo(BrandMark);
