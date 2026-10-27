export interface PlanDef {
    id: string;
    name: string;
    syncIntervalSec: number;
    maxDevices: number;
    maxTabs: number;
}

// 플랜 카탈로그. 유일 진실. id로 구분, 해석된 값은 DB에 같이 저장한다.
export const PLANS: Record<string, PlanDef> = {
    "plan-1": { id: "plan-1", name: "Starter", syncIntervalSec: 1800, maxDevices: 1, maxTabs: 3 },
    "plan-2": { id: "plan-2", name: "Pro", syncIntervalSec: 600, maxDevices: 3, maxTabs: 20 },
    "plan-3": { id: "plan-3", name: "Team", syncIntervalSec: 60, maxDevices: 10, maxTabs: 100 },
};

export const DEFAULT_PLAN_ID = "plan-1";

export function planOf(id: string | null | undefined): PlanDef {
    return (id && PLANS[id]) || PLANS[DEFAULT_PLAN_ID];
}
