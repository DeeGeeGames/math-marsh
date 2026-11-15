# Steam achievement mechanism

Only initialized paid app 4927380 uses the app-owned Steamworks session for achievements. Demo 5493870, web/PWA and standalone builds grant nothing. The mechanism shipped with an empty registry in #121. #122 registers exactly the six capstones below; fixture names exist only in tests.

The profile persistence service observes a complete successful operation and reads back the supported persistent roster before evaluating pure per-profile predicates. Any one saved profile must satisfy the whole rule. Read-only and session-only results submit nothing, including partially failed create/delete operations. Reading back also prevents temporary Practice evidence from a preserved future payload from qualifying. No save fields or versions change.

The main-process bridge validates the calling window and the entire API-name request. Its session queue retries once per minute, serializes manager calls, and avoids duplicate stores while a name remains unlocked. Failed queries, missing definitions and failed stores remain pending without blocking unrelated names or play. Profile deletion never clears Steam records. Shutdown clears the retry timer and disposes the queue before the existing Steam session.

SDK `steamworks-ffi-node` 0.11.3 initializes with a current-stats request. The queue uses the public stats manager's `requestUserStats` for this session's Steam ID and the achievement manager's query/unlock methods. `unlockAchievement` calls SetAchievement followed by StoreStats and returns false on either failure. After any attempted unlock, an in-memory unlocked bit is insufficient proof of storage: retry still calls unlock/store. The SDK exposes StoreStats' immediate bool rather than server callback confirmation. An accepted call remains provisional: every submitted name stays under observation for the session. Each minute the queue requests stats and reads achievement state again; if Steam later replaces an accepted unlock with locked state, it retries without needing another profile write. Unlocked names do not cause duplicate stores. This reconciliation uses public SDK managers and does not claim independent server acknowledgement.

[Valve's user stats API](https://partner.steamgames.com/doc/api/ISteamUserStats) documents SetAchievement as an in-memory change, StoreStats retries/rate limiting, and the deprecated startup RequestCurrentStats. No private SDK access, second SDK instance, clear call, substitute toast, or achievement state in progress.json is used.

Automated tests cover readiness/request failure, query exceptions, absent definitions, failed stores that leave an in-memory unlock, retries, serialization, duplicate suppression and invalid names. Tests also exercise the installed SDK achievement/stats managers over stubbed FFI: one failing or missing name permits later names to unlock, and a locked result after immediate store acceptance triggers another store. They do not prove native Steam overlay behavior or library records. Published partner definitions, native unlock and overlay/library acceptance remain outstanding.

## Paid catalog and owner publication prerequisites

Configure these six visible achievements on paid app **4927380 only**, with no progress bar and no hidden flag. API names are permanent once published. Do not configure the demo (5493870): records do not transfer between app IDs.

| API name | English display name | English description |
| --- | --- | --- |
| `ACH_FIRST_STEP_UP` | First Step Up | Unlock step 2 in any operation. |
| `ACH_EVERY_OPERATION` | Every Operation | Unlock step 11 in addition, subtraction, multiplication, and division. |
| `ACH_WHOLE_SHOW` | The Whole Show | Unlock Snack Break, The Big Jump, The Web Guitar, and The Big Plan. |
| `ACH_TOPIC_PRACTICED` | Topic Practiced | Answer every fact in one Practice topic correctly. |
| `ACH_PRACTICE_COMPLETE` | Practice Complete | Practice every topic. |
| `ACH_LESSONS_DONE` | Lessons Done | Finish all three tutorials. |

Each entire predicate must match one saved learner. Math uses highestUnlockedStep, so step 1 earns nothing, selecting an earlier current step does not revoke eligibility, and accelerated step-11 unlocks count. Every Operation requires all four operations at 11. The Whole Show requires saved scene IDs snack-break, the-big-jump, the-web-guitar and the-big-plan; skipping playback or using level selection adds no exception.

Practice uses practiceTopicStatus with related=false. The current catalog has **60** topics: 12 multiplication tables, 12 division tables, 18 addition Make topics and 18 subtraction Make topics. Each own fact must have at least one correct answer; later misses do not revoke it. Practice Complete requires all 60 on one profile. Pending or skipped tutorials do not qualify: basics, operands and operand-and-result must all be completed together.

The owner must supply one **64×64 unlocked icon** per achievement; Steam can generate locked grayscale versions. Enter the exact rows in Stats & Achievements, upload icons and publish the definitions before native acceptance. This implementation performs no uploads or partner-site publication. There is no live toast proof until definitions are published. Then test the Steam-launched paid app with the intended account and a qualifying saved roster, allow the queued delivery cadence, and verify the Steam overlay and library entry. Automated tests do not establish those results. No substitute notification or in-game gallery is provided.
