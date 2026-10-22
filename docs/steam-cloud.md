# Steam Cloud saves

Steam desktop builds use Steam Auto-Cloud over one portable, versioned JSON file per Steam account. Steam Input and saves share one app-owned SDK session; failure to initialize a controller does not disable save identity. Browser and standalone desktop builds continue using localStorage.

## Save behavior

- Save location: `<Electron appData>/math-marsh/steam-saves/<64-bit Steam ID>/progress.json`.
- The outer format is `{ "version": 1, "values": { "storage-key": "stored-string" } }`. It retains the existing versioned profile format and validators. The profile roster, names, selected player, arithmetic progression, tutorial completion, and unlocked skits travel together. Legacy learning keys are retained until the first named profile adopts them.
- Audio, fullscreen, touch settings, controller ownership, and Chromium's database stay local. There is no in-progress run transfer.
- Each existing profile operation writes immediately through Electron's synchronous storage bridge. Writes go to a temporary file, are flushed, then replace the previous save atomically. Failed writes leave the previous file intact and use the existing session-only indication. Files larger than 1 MiB, malformed envelopes, and unknown envelope versions are preserved without overwriting them. Existing profile validation also protects unknown profile versions.
- Steam synchronizes before launch and after exit, including changes made offline once the client reconnects. Steam handles file conflicts before launch; the game does not merge different devices' progress. Choose the desired copy in Steam's conflict dialog.
- Dynamic Cloud Sync is **not supported**. The running game reads its save at startup; it must be closed on one device before continuing on another. Leave Dynamic Cloud Sync disabled.
- A single-instance lock prevents concurrent local writers. Steam identity failure blocks portable storage instead of falling back to shared localStorage and exposing another user's progress.

## Existing-install migration

The first Steam account to launch the updated game claims this installation's old localStorage learning data. Migration copies only the portable keys and leaves the old values untouched. The local ownership record is `<Electron appData>/math-marsh/steam-save-migration.json`; it is not cloud synced. If a cloud save already exists, that save takes precedence and the old browser values remain available locally. Subsequent Steam accounts start independently and never import the same shared legacy data. A failed import can retry for the claiming account.

Standalone desktop play continues with its original localStorage data and does not mirror later Steam progress. This is intentional account isolation; do not delete the migration record to move saves between accounts. Preserve both files if investigating recovery.

## Steamworks configuration (app 4927380)

Code alone does not enable Steam Cloud. In Steamworks **Application > Steam Cloud**, configure and publish the following settings. Start with **Enable cloud support for developers only** for a released app, and keep that restriction until the acceptance checks below pass.

- Byte quota per user: **1048576** (1 MiB).
- Number of files per user: **1**.
- Dynamic Cloud Sync: **disabled**.
- Auto-Cloud root: **WinAppDataRoaming**.
- Subdirectory: **math-marsh/steam-saves/{64BitSteamID}**.
- Pattern: **progress.json**.
- OS restriction: **Cross-Platform**.
- Recursive: **disabled**.
- Linux root override: original **WinAppDataRoaming**, new root **LinuxHome**, add/replace path **.config**, replace path **disabled**. Expected Linux path: `~/.config/math-marsh/steam-saves/<SteamID>/progress.json`.

Electron uses `$XDG_CONFIG_HOME` on Linux when set. If the supported Steam launch environment overrides it, adjust the Linux override to the actual appData directory before enabling cloud; `.config` is for the default environment. Windows uses the redirected roaming AppData folder through Electron/Steam's platform APIs. No macOS desktop target is currently packaged.

Sync only `progress.json`. Do not use a recursive wildcard: the migration record, `.tmp` files, and device settings must not enter the cloud. Do not add Remote Storage API writes alongside these rules.

## Acceptance before public enablement

1. Launch the exact Steam-delivered build as account A with existing local progress. Verify names, selected player, per-operation unlocks, tutorials, and skits survive migration. Rename/create/delete a profile and complete a learning round; exit normally and verify Steam reports successful upload.
2. Launch that build on a second PC or Steam Deck using A. Verify the same data downloads and loads before the game starts. Change progress, exit, and verify the first device receives it on its next launch. Test Windows to Linux/Deck as well as same-platform transfer.
3. Start offline, change progress, exit, reconnect, and verify upload/download. With cloud disabled for the account or game, verify local saves still persist.
4. Create divergent offline saves on two devices. Reconnect and verify Steam's conflict dialog lets the player select the desired file, which the game loads intact. Do not run both copies concurrently during ordinary acceptance.
5. On the same OS login, switch to Steam account B. Verify A's roster is absent, B starts independently, and returning to A restores A. Also test standalone launch; it must retain the original local data.
6. With copies backed up, test invalid/future save files and denied disk writes. The previous file must stay intact, and the game must show its session-only fallback rather than claim successful persistence. Restore the backed-up save afterward.
7. Keep Cloud disabled for public users until these checks pass. Automated tests simulate the file transfer and failure paths; they do not prove Steam upload, download, conflict prompts, or Deck suspend behavior.

Official configuration reference: https://partner.steamgames.com/doc/features/cloud
