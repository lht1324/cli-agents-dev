// 데몬 공용 타입. messages ⇄ localdb 순환 방재용.

export interface ServerMessage {
    id: string;
    type: string;
    time?: { created?: number };
    text?: string;
    payload?: { text?: string };
    content?: {
        type: string;
        text?: string;
        name?: string;
        state?: { input?: unknown; content?: { type?: string; text?: string }[] };
    }[];
    summary?: string;
}

export interface PlainRow {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: number | null;
}
