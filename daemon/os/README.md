# OS 등록 (부팅 자동시작)

`cliagent run`을 OS에 등록한다. 환경값 3개는 각 OS 방식으로 넣는다.
(`DATABASE_URL`, `OPENCODE_SERVER_URL`, `OPENCODE_SERVER_PASSWORD`)

## Arch Linux (systemd user)

```bash
mkdir -p ~/.config/systemd/user
cp daemon/os/cliagent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now cliagent.service
systemctl --user status cliagent.service
```

`Environment=` 3줄에 값을 채운 뒤 reload.

## macOS (LaunchAgent)

```bash
cp daemon/os/dev.cliagents.daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/dev.cliagents.daemon.plist
```

plist의 `EnvironmentVariables` 3개를 채운 뒤 load.

## Windows (작업 스케줄러)

작업 스케줄러 → 작업 가져오기 → `daemon/os/cliagent-task.xml`.
동작 편집에서 환경 변수를 추가한다.
