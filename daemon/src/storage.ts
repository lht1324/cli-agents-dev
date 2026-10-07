import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// env 폴백. systemd는 EnvironmentFile로 주지만 수동 실행은 못 받는다. 600 파일 직접 읽기.
function envFile(): Record<string, string> {
    try {
        const raw = readFileSync(join(homedir(), ".config", "localagents", "env"), "utf8");
        const out: Record<string, string> = {};
        for (const line of raw.split("\n")) {
            const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (m) {
                out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
            }
        }
        return out;
    } catch {
        return {};
    }
}

function val(name: string): string {
    return process.env[name] ?? envFile()[name] ?? "";
}

let client: S3Client | null = null;

export function bucket(): string {
    return process.env.HANDOFF_BUCKET ?? "localagents-handoffs";
}

export function s3(): S3Client {
    if (client) {
        return client;
    }
    const endpoint = val("AWS_ENDPOINT_URL_S3");
    const region = val("AWS_REGION") || "ap-southeast-1";
    const accessKeyId = val("AWS_ACCESS_KEY_ID");
    const secretAccessKey = val("AWS_SECRET_ACCESS_KEY");
    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("storage credentials are not set (AWS_* in env file)");
    }
    client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
    });
    return client;
}

export async function putBytes(key: string, body: Uint8Array): Promise<void> {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: "application/gzip" }));
}

export async function getBytes(key: string): Promise<Uint8Array> {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) {
        throw new Error(`empty object: ${key}`);
    }
    return res.Body.transformToByteArray();
}

export function storageReady(): boolean {
    try {
        s3();
        return true;
    } catch {
        return false;
    }
}
