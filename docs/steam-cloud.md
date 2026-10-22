# Steam Cloud saves

Steam builds use Auto-Cloud for one portable JSON file per Steam account. Steam Input and saves share one app-owned SDK session; controller initialization failure does not disable save identity. Browser and standalone desktop builds continue using localStorage.

## Save behavior

- Both Steam apps use `<Electron appData>/math-marsh/steam-saves/<64-bit Steam ID>/progress.json`, regardless of product name. Browser and standalone builds never access this file.
- The envelope is `{ "version": 1, "saveOwner": "demo" | "paid", "values": { "storage-key": "stored-string" } }`. `saveOwner` is optional only for legacy compatibility: an existing version-1 save without it is paid-owned. Never infer ownership from its contents.
- A new paid save is marked `paid`; a new demo save is marked `demo`. If the paid app loads a supported demo-owned save, it atomically changes only `saveOwner` to `paid`, preserving all values and unknown envelope fields. That is the one-time handoff. Paid saves are never demoted, and there is no ongoing merge or union of demo progress into paid progress.
- An existing paid-owned save, including an unmarked legacy save, wins within the file Steam supplies. The demo reads it as read-only and cannot change profiles, names, deletions, selected player, progress, tutorials, or other saved values. Demo play can continue in memory; the existing UI says the changes are temporary and last until the game closes. This intentional read-only state is not a disk error.
- Steam resolves cross-device conflicts before launch. Ownership precedence applies to the selected file only: it cannot recover paid progress if a player chooses an older demo copy in Steam's conflict dialog.
- The profile roster, names, selected player, arithmetic progression, tutorial completion, and unlocked skits travel together. Audio, fullscreen, touch settings, controller ownership, Chromium's database, and in-progress runs stay local.
- Each profile operation writes immediately through Electron's storage bridge using a flushed temporary file and atomic replacement. A failed write leaves the prior file intact and uses the existing session-only failure handling. If a file disappears after being loaded, a write fails instead of recreating it from stale memory.
- Malformed or oversized envelopes, unsupported envelope/profile versions, and invalid ownership metadata remain untouched. A failed paid promotion also leaves the original file intact, uses session-only handling, and can retry on a later paid launch. Keep the 1 MiB file limit and supported-format forward-compatibility safeguards.
- Steam synchronizes Auto-Cloud files before launch and after exit. Dynamic Cloud Sync is unsupported; keep it disabled and close the game before continuing on another device. Steam identity failure blocks portable storage instead of falling back to shared localStorage.

## Existing-install migration

The first Steam account to launch the updated paid game claims that installation's old localStorage learning data. Migration copies only the portable keys and leaves the old values untouched. The local ownership record is `<Electron appData>/math-marsh/steam-save-migration.json`; it is not cloud synced. If a cloud save already exists, it takes precedence and the old browser values remain available locally. Subsequent Steam accounts start independently and never import the same shared legacy data. A failed import can retry for the claiming account.

The demo has a distinct Electron `userData` directory, so its Chromium data and migration ownership record stay separate. Both apps still share the Steam save path under `appData`. Standalone desktop play continues with its original localStorage data and does not mirror later Steam progress. Do not delete a migration record to move saves between accounts; preserve both files when investigating recovery.

## Steam app identity and demo prerequisite

The paid app ID is `4927380`. `DEMO_APP_ID` is currently `null`: Steamworks had no assigned demo app on 2026-10-22, and its associated page still showed **Add Demo**. After Steamworks assigns the ID, set that constant and initialize each build with its own app ID. Do not guess an ID.

The demo's `userData` must remain distinct from the paid app's. Both apps use the shared `appData` save path above. Once the demo app exists, configure its Steam Cloud **Shared cloud APP ID** as `4927380` and mirror the paid Auto-Cloud file rule and quota. That configuration cannot be completed before Steamworks creates the demo app. Steamworks does not sync shared cloud data while the target/base app is unreleased; developers-only mode does not bypass that restriction.

## Published Steamworks configuration for app 4927380

The paid app's published Auto-Cloud settings were checked live on 2026-10-22. Steamworks **View Diffs** reported **No uncommitted app data**.

- Per-user byte quota: **1048576** (1 MiB); file quota: **10**.
- Exactly one Auto-Cloud rule matches the save: root **WinAppDataRoaming**, subdirectory **math-marsh/steam-saves/{64BitSteamID}**, pattern **progress.json**.
- OS restriction: **Cross-Platform**; recursive matching: **off**.
- Linux override: original root **WinAppDataRoaming**, new root **LinuxXdgConfigHome**, Add/Replace Path empty, Replace Path **off**. This maps to Electron's Linux `appData` root; by default that is under `~/.config`.
- Dynamic Cloud Sync: **off**. **Enable cloud support for developers only**: **off**.

Sync only `progress.json`; the migration record, temporary files, and device settings must not enter the cloud. Do not add Remote Storage API writes alongside Auto-Cloud. See [Steamworks Steam Cloud documentation](https://partner.steamgames.com/doc/features/cloud) for the current Auto-Cloud and shared-app settings.

## Validation and release boundary

Local profile-storage adapter integration tests are code evidence for file behavior only. No Steam-launched native build handoff or Steam Cloud upload/download was verified in this run.

Before release, verify same-machine native handoff with both app identities: demo-first must promote once in the paid app; paid-first must remain byte-identical during demo play, including attempted mutations and load-time repair. This checks local file sharing and ownership behavior, not Steam Cloud transfer.

Native Linux apps can share the same `appData` directory. Proton gives the two apps separate prefixes, so matching path text alone does not transfer the local file; cross-app Shared Cloud is required there. Simultaneous game instances are outside this handoff's acceptance scope.

After the paid/base app is released, test Steam-delivered transfer across two devices, including Windows and Steam Deck/Proton. Cover demo-first and paid-first, confirm Steam supplies the expected file before launch, and exercise Steam's conflict flow. Complete these transfer checks before enabling public demo Cloud. Local tests and same-machine handoff do not prove Steam upload or download.
