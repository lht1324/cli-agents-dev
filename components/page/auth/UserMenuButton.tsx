"use client";

import { UserButton } from "@neondatabase/auth-ui";
import type { ReactNode } from "react";

// 서버 레이아웃에서 클라이언트 훅(아이콘 등)을 넘길 수 없어 클라이언트 컴포넌트로 분리했다.
interface Props {
    links?: {
        href: string;
        icon?: ReactNode;
        label: string;
    }[];
}

export default function UserMenuButton({ links }: Props) {
    return (
        <UserButton
            size="icon"
            additionalLinks={links?.map((link) => ({
                href: link.href,
                icon: link.icon,
                label: link.label,
                signedIn: true,
                separator: true,
            }))}
        />
    );
}
