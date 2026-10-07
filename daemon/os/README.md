# OS 등록 (부팅 자동시작)

`agentgit run`을 OS에 등록한다. 비밀은 unit이 아니라 `~/.config/agentgit/env` 1줄씩 둔다.
(`DATABASE_URL` 1개. 서버 URL·비번은 데몬이 상태 파일로 알아서 한다)

## Arch Linux (systemd user)

```bash
mkdir -p ~/.config/systemd/user
cp daemon/os/agentgit.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now agentgit.service
systemctl --user status agentgit.service
```

`Environment=` 3줄에 값을 채운 뒤 reload.

## macOS (LaunchAgent)

```bash
cp daemon/os/dev.agentgit.daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/dev.agentgit.daemon.plist
```

plist의 `EnvironmentVariables` 3개를 채운 뒤 load.

## Windows (작업 스케줄러)

작업 스케줄러 → 작업 가져오기 → `daemon/os/agentgit-task.xml`.
동작 편집에서 환경 변수를 추가한다.
