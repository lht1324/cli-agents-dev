import { execFileSync } from "node:child_process";
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

// 상주 데몬을 OS 사용자 서비스로 등록한다. sudo가 필요 없다.
// npx로 실행하면 패키지가 임시 캐시(~/.npm/_npx/<hash>)에 있어 언제 사라질지 모른다.
// 그래서 실행 파일을 안정된 경로로 복사한 뒤 그 경로를 서비스가 가리키게 한다.

const UNIT = "localagents.service";
const MAC_LABEL = "link.localagents.daemon";

export interface ServiceResult {
    ok: boolean;
    message: string;
}

function appDir(): string {
    return join(homedir(), ".local", "share", "localagents", "app");
}

function shimPath(): string {
    return join(homedir(), ".local", "bin", "localagents");
}

function unitPath(): string {
    return join(homedir(), ".config", "systemd", "user", UNIT);
}

function plistPath(): string {
    return join(homedir(), "Library", "LaunchAgents", `${MAC_LABEL}.plist`);
}

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
    try {
        const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { ok: true, out };
    } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        return { ok: false, out: (err.stderr ?? err.stdout ?? err.message ?? "").toString().trim() };
    }
}

// 지금 실행 중인 dist 디렉토리를 안정 경로로 복사한다.
function copyPayload(): string {
    const source = dirname(process.argv[1] ?? "");
    const target = appDir();
    if (!source || !existsSync(join(source, "index.js"))) {
        throw new Error("cannot locate the daemon files to install");
    }
    if (source === join(target, "dist")) {
        // 이미 안정 경로에서 실행 중 (서비스가 이 경로로 돌고 있다).
        return target;
    }
    mkdirSync(target, { recursive: true });
    rmSync(join(target, "dist"), { recursive: true, force: true });
    cpSync(source, join(target, "dist"), { recursive: true });
    const pkg = join(dirname(source), "package.json");
    if (existsSync(pkg)) {
        cpSync(pkg, join(target, "package.json"));
    }
    return target;
}

function writeShim(): void {
    const bin = shimPath();
    // 이미 다른 localagents가 PATH에 있으면 건드리지 않는다 (개발 중인 repo 실행 파일 보존).
    if (existsSync(bin)) {
        return;
    }
    mkdirSync(dirname(bin), { recursive: true });
    writeFileSync(
        bin,
        `#!/bin/sh\nexec "${process.execPath}" "${join(appDir(), "dist", "index.js")}" "$@"\n`,
    );
    chmodSync(bin, 0o755);
}

// shim 디렉토리가 PATH에 없으면 `localagents push`가 "command not found"가 된다.
// 유저에게 설정을 떠넘기지 않고 셸 프로필에 한 줄 추가한다 (표식이 있어 중복 추가는 안 된다).
const PATH_MARKER = "# localagents";

function rcPath(): { file: string; fish: boolean } {
    const home = homedir();
    const shell = process.env.SHELL ?? "";
    if (shell.endsWith("zsh")) {
        return { file: join(home, ".zshrc"), fish: false };
    }
    if (shell.endsWith("fish")) {
        return { file: join(home, ".config", "fish", "config.fish"), fish: true };
    }
    if (shell.endsWith("bash")) {
        const profile = join(home, ".bash_profile");
        if (platform() === "darwin" && existsSync(profile)) {
            return { file: profile, fish: false };
        }
        return { file: join(home, ".bashrc"), fish: false };
    }
    return { file: join(home, ".profile"), fish: false };
}

export function ensureShellPath(): string | null {
    const dir = dirname(shimPath());
    if ((process.env.PATH ?? "").split(":").includes(dir)) {
        return null;
    }
    const { file, fish } = rcPath();
    try {
        mkdirSync(dirname(file), { recursive: true });
        const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
        if (existing.includes(PATH_MARKER)) {
            return `PATH already configured in ${file} (open a new terminal to use the short commands)`;
        }
        const block = fish
            ? `\n${PATH_MARKER}\nfish_add_path "${dir}"\n`
            : `\n${PATH_MARKER}\nexport PATH="${dir}:$PATH"\n`;
        appendFileSync(file, block);
        return `added ${dir} to PATH in ${file} (open a new terminal to use the short commands)`;
    } catch {
        return `add to your shell profile to use the short commands: export PATH="${dir}:$PATH"`;
    }
}

export function removeShellPath(): void {
    const dir = dirname(shimPath());
    const { file, fish } = rcPath();
    if (!existsSync(file)) {
        return;
    }
    try {
        const text = readFileSync(file, "utf8");
        if (!text.includes(PATH_MARKER)) {
            return;
        }
        const block = fish
            ? `${PATH_MARKER}\nfish_add_path "${dir}"\n`
            : `${PATH_MARKER}\nexport PATH="${dir}:$PATH"\n`;
        const cleaned = text.split(block).join("").replace(/\n{3,}/g, "\n\n");
        writeFileSync(file, cleaned);
    } catch {
        // 무시
    }
}

function systemdUnit(): string {
    // EnvironmentFile은 앞에 '-'를 붙여 없어도 실패하지 않게 한다.
    return `[Unit]
Description=localagents resident daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart="${shimPath()}" run
EnvironmentFile=-%h/.config/localagents/env
KillMode=process
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
`;
}

function launchAgentPlist(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>${MAC_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${shimPath()}</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>${join(homedir(), ".local", "state", "localagents", "daemon.log")}</string>
    <key>StandardErrorPath</key><string>${join(homedir(), ".local", "state", "localagents", "daemon.log")}</string>
</dict>
</plist>
`;
}

export function installService(): ServiceResult {
    const os = platform();
    if (os !== "linux" && os !== "darwin") {
        return { ok: false, message: `background service is not supported on ${os} yet` };
    }
    try {
        copyPayload();
        writeShim();
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }

    if (os === "darwin") {
        const dir = dirname(plistPath());
        mkdirSync(dir, { recursive: true });
        mkdirSync(join(homedir(), ".local", "state", "localagents"), { recursive: true });
        writeFileSync(plistPath(), launchAgentPlist());
        const uid = typeof process.getuid === "function" ? process.getuid() : 501;
        run("launchctl", ["bootout", `gui/${uid}/${MAC_LABEL}`]);
        const loaded = run("launchctl", ["bootstrap", `gui/${uid}`, plistPath()]);
        if (!loaded.ok) {
            return { ok: false, message: `launchctl bootstrap failed: ${loaded.out}` };
        }
        const hint = ensureShellPath();
        return { ok: true, message: `background service installed (launchd)${hint ? `. ${hint}` : ""}` };
    }

    mkdirSync(dirname(unitPath()), { recursive: true });
    writeFileSync(unitPath(), systemdUnit());
    const reload = run("systemctl", ["--user", "daemon-reload"]);
    if (!reload.ok) {
        return { ok: false, message: `systemctl --user daemon-reload failed: ${reload.out}` };
    }
    const enabled = run("systemctl", ["--user", "enable", "--now", UNIT]);
    if (!enabled.ok) {
        return { ok: false, message: `systemctl --user enable failed: ${enabled.out}` };
    }
    const hint = ensureShellPath();
    return { ok: true, message: `background service installed (systemd user)${hint ? `. ${hint}` : ""}` };
}

// 로그아웃용. 유닛은 남겨두고 프로세스만 멈춘다 (재로그인하면 다시 켜진다).
export function stopService(): ServiceResult {
    const os = platform();
    if (os === "darwin") {
        const uid = typeof process.getuid === "function" ? process.getuid() : 501;
        run("launchctl", ["bootout", `gui/${uid}/${MAC_LABEL}`]);
        return { ok: true, message: "background service stopped" };
    }
    if (os === "linux") {
        const res = run("systemctl", ["--user", "stop", UNIT]);
        return { ok: res.ok, message: res.ok ? "background service stopped" : res.out };
    }
    return { ok: true, message: "no background service to stop" };
}

// uninstall용. 서비스·복사본·실행 shim을 모두 제거한다.
export function uninstallService(): ServiceResult {
    const os = platform();
    if (os === "darwin") {
        const uid = typeof process.getuid === "function" ? process.getuid() : 501;
        run("launchctl", ["bootout", `gui/${uid}/${MAC_LABEL}`]);
        rmSync(plistPath(), { force: true });
    } else if (os === "linux") {
        run("systemctl", ["--user", "stop", UNIT]);
        run("systemctl", ["--user", "disable", UNIT]);
        rmSync(unitPath(), { force: true });
        run("systemctl", ["--user", "daemon-reload"]);
    }

    // shim이 우리가 만든 것일 때만 지운다 (다른 설치 방식과 충돌 방지).
    try {
        const bin = shimPath();
        if (existsSync(bin) && readFileSync(bin, "utf8").includes(join(appDir(), "dist", "index.js"))) {
            rmSync(bin, { force: true });
        }
    } catch {
        // 무시
    }
    removeShellPath();
    rmSync(appDir(), { recursive: true, force: true });
    return { ok: true, message: "background service and installed files removed" };
}
