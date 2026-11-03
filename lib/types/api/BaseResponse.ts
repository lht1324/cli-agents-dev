export interface BaseResponse {
    success: boolean;
    status: number;
    message?: string;
    error?: string;
}
