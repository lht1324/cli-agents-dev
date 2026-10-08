import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

function ask(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// OS 기본 폴더 선택. 터미널이 띄우고 경로를 받아온다. 실패하면 직접 입력.
export async function pickDirectory(startDir?: string | null): Promise<string | null> {
    if (!process.stdin.isTTY) {
        return null;
    }
    const start = startDir ?? join(homedir(), "Projects");
    try {
        const plat = platform();
        if (plat === "darwin") {
            const out = execSync(
                `osascript -e 'tell application (path to frontmost application as text) to set theFolder to choose folder with prompt "Pick a folder" default location (POSIX file "${start.replace(/"/g, "")}")' -e 'get POSIX path of theFolder'`,
                { timeout: 120000, encoding: "utf8" },
            ).trim();
            if (out && existsSync(out)) {
                return out.replace(/\/$/, "");
            }
            return null;
        }
        if (plat === "win32") {
            const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.SelectedPath = '${start}'; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`;
            const out = execSync(`powershell -NoProfile -Command "${ps}"`, { timeout: 120000, encoding: "utf8" }).trim();
            return out.length > 0 ? out : null;
        }
        for (const cmd of [
            `zenity --file-selection --directory --title="Pick a folder" --filename="${start}/"`,
            `kdialog --getexistingdirectory "${start}"`,
        ]) {
            try {
                const out = execSync(cmd, { timeout: 120000, encoding: "utf8" }).trim();
                if (out && existsSync(out)) {
                    return out;
                }
            } catch {
                // 다음 후보
            }
        }
    } catch {
        // 직접 입력으로 폴백
    }
    const typed = await ask(`Folder path [${start}]: `);
    const dir = typed.length > 0 ? typed : start;
    return dir;
}

export function isDir(path: string): boolean {
    try {
        return existsSync(path) && statSync(path).isDirectory();
    } catch {
        return false;
    }
}

export async function askTyped(question: string): Promise<string> {
    if (!process.stdin.isTTY) {
        return "";
    }
    return ask(question);
}
