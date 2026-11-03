import { getFetch } from "./baseFetch";
import { readBaseResponse } from "./readBaseResponse";

export interface Account {
    email: string | null;
    name: string | null;
    image: string | null;
    memberSince: string | null;
    planId: string;
    status: string | null;
    interval: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    deviceCount: number;
    sessionCount: number;
    daysLeft: number | null;
    billingBlocked: boolean;
}

export interface BillingStatus {
    daysLeft: number | null;
    billingBlocked: boolean;
}

export const accountClientAPI = {
    async getAccount(): Promise<Account | null> {
        return readBaseResponse<Account>(await getFetch("/api/web/account"));
    },

    async getBillingStatus(): Promise<BillingStatus | null> {
        return readBaseResponse<BillingStatus>(await getFetch("/api/web/me"));
    },
};
