import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { trialDaysLeft } from "@/lib/billing";
import BillingLockedClient from "./BillingLockedClient";

// 트라이얼 종료 화면. 31일째부터 /sessions·/devices 진입 시 여기로 온다.
// 데이터는 삭제하지 않는다 — 재구독하면 그대로 돌아온다 (PLAN-BILLING.md §1).
export default async function BillingLockedPage() {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }
    const daysLeft = await trialDaysLeft(session.user.id);
    // active 구독이 생겨 게이트를 이미 통과하는 상태로 리다이렉트됐다면 인박스로 돌려보낸다.
    if (daysLeft === null) {
        redirect("/sessions");
    }
    return <BillingLockedClient />;
}
