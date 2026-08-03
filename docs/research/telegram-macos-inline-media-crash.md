# Telegram macOS inline-media crash research

Date: 2026-07-31  
Updated: 2026-08-03

## Conclusion

The strongest evidence does **not** point to file size, H.264 profile, chroma format, or a malformed MP4 as the primary cause.

The local Telegram crash reports show a deterministic **stack overflow / excessive recursion on Telegram's `MediaBox-Data` queue** while inline-result media are being fetched. Seven reports from July 28–31 have the same queue and repeated Telegram frame offsets. An independent report for `@GiphyBot` has the same Telegram version, binary UUID, queue, and four-frame recursion cycle.[^exact-macos-issue] This is a confirmed Telegram for macOS 12.9 client bug, although our result shape can trigger it.

There is also one concrete defect in the original payloads: some KLIPY MP4 renditions contain a silent AAC track, while Telegram defines `InlineQueryResultMpeg4Gif` as H.264/MPEG-4 AVC **without sound**. That should be fixed, but the crash stack does not prove that it is the recursion trigger.

Returning KLIPY's smallest actual GIF rendition as `InlineQueryResultGif` substantially reduced the crash frequency and initially remained stable with up to 50 results. Controlled tests isolated the practical trigger to Telegram's concurrent **cold remote-media fetch/cache path**: exact URL sets crashed when newly introduced media were fetched, then worked unchanged after those URLs became warm. A later cold group of four `xs.gif` files totaling only 351 KB also reproduced the crash, proving that the smallest rendition mitigates but does not eliminate the client bug. Result count, individual malformed files, media format, total encoded bytes, frame count, duration, and decoded pixel workload do not independently predict it.

## Outcome update: working mitigation

The following sequence was tested on Telegram for macOS 12.9 build 282555:

| Experiment                                                          | Result                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 24 remote `sm.mp4` items as `mpeg4_gif`                             | Crashed                                                                                                      |
| 8 remote `sm.mp4` items as `mpeg4_gif` with static JPEG thumbnails  | Still crashed                                                                                                |
| Inline-mode Mini App gallery                                        | Avoided the native grid, but Telegram Mac opened it in a separate in-app window; rejected as the desired UX  |
| 8 remote `xs.gif` items as `gif` with static JPEG thumbnails        | No crash observed                                                                                            |
| Up to 50 remote `xs.gif` items as `gif` with static JPEG thumbnails | No crash observed; reported as working perfectly                                                             |
| Up to 50 remote `sm.gif` items as `gif` with static JPEG thumbnails | Crashed; the gallery tiles were animated, proving Telegram fetched the larger `gif_url` for preview playback |
| Four cold `xs.gif` items totaling 351 KB with cold JPEG thumbnails  | Crashed once, then the identical query worked immediately after the resources were warm                      |

One test briefly showed blank result slots for some items. That may be an individual GIF or thumbnail fetch/decoding failure and has not been reproduced or diagnosed. It did not cause a crash.

Commits recording the experiments:

- `d40ff01`: remove the Mini App and return actual `xs.gif` inline results;
- `b5443f9`: raise the page size from 8 to Telegram's maximum of 50;
- `4160d60`: test `sm.gif` as the selected media; reverted after it crashed Telegram Mac;
- `e18a9fe`: add bounded `!test` queries with rendition selection, deterministic subsets, unique result IDs, and media metadata logging.

During testing, `cache_time` is `0` so repeated queries exercise the current payload instead of an older cached answer.

### Controlled cold/warm-cache findings

The diagnostic query mode held the search, item positions, result type, and JPEG thumbnails constant while varying rendition, subset, and cache state. Key observations:

| Test                                                             | Static metrics                                  | Result  |
| ---------------------------------------------------------------- | ----------------------------------------------- | ------- |
| `cats`, `sm`, positions 1–3                                      | 3.446 MB, 138 frames, 4.94M decoded pixels      | Worked  |
| `cats`, `sm`, positions 1–4 with newly introduced media          | 3.742 MB, 150 frames, 5.52M pixels              | Crashed |
| `cats`, `sm`, positions 2–5                                      | 3.398 MB, 140 frames, 5.30M pixels              | Worked  |
| `cats`, `sm`, positions 3–7                                      | 3.441 MB, 151 frames, 5.79M pixels              | Worked  |
| `cats`, `xs`, positions 1–4                                      | 0.862 MB, same 150 frames and durations as `sm` | Worked  |
| `cats`, `sm`, positions 1–4 after all four URLs were warm        | Identical to the earlier crashing payload       | Worked  |
| `dogs`, `sm`, positions 1–4                                      | 3.001 MB, 149 frames, 5.36M pixels              | Worked  |
| `dogs`, `sm`, positions 1–5 when position 5 was newly introduced | 3.097 MB, 153 frames, 5.58M pixels              | Crashed |
| `dogs`, `sm`, position 5 alone                                   | 0.096 MB, 4 frames, 0.22M pixels                | Worked  |
| `dogs`, `sm`, positions 1–5 after position 5 was warm            | Identical to the earlier crashing payload       | Worked  |
| `otters`, `sm`, positions 1–4 on first load                      | 2.406 MB                                        | Crashed |
| `otters`, identical positions immediately repeated               | Same URLs and metadata                          | Worked  |
| `raccoons`, `xs`, positions 1–4 on first load                    | 0.351 MB                                        | Crashed |
| `raccoons`, identical positions immediately repeated             | Same URLs and metadata                          | Worked  |

The controlled crashes produced reports at 21:16, 21:28, 21:36, 21:38, and 21:41 on August 3. The inspected reports were again `EXC_BAD_ACCESS` / `SIGBUS` stack-guard failures on `MediaBox-Data`.

These comparisons rule out a deterministic malformed asset or a simple threshold based on count, compressed bytes, frames, duration, or decoded pixels. The same remote URLs changing from crash to success immediately after warming is direct evidence that fetch/cache timing and synchronous media-resource recursion are essential to the trigger. The 351 KB `xs.gif` failure also shows that reducing payload size only lowers probability.

## Original crashing payload

The original `src/inline-query/map-result.ts` mapping sent:

- `type: "mpeg4_gif"`
- KLIPY `file.sm.mp4` as `mpeg4_url`
- matching KLIPY width and height
- KLIPY `file.sm.jpg` as a static JPEG thumbnail

The thumbnail fields were valid: Telegram permits JPEG thumbnails and makes `mpeg4_width`, `mpeg4_height`, and duration optional. The media contract is stricter: an MPEG-4 GIF is an H.264/MPEG-4 AVC video without sound.[^bot-api]

Telegram's own GIF documentation likewise says Telegram GIFs are soundless H.264 MPEG-4 videos and that uploaded GIF images are converted to MPEG-4.[^telegram-gifs]

## Current lowest-risk payload

The bot requests `gif,jpg` from KLIPY and maps each normal-search item to:

- `type: "gif"` (`InlineQueryResultGif`);
- KLIPY `file.xs.gif` as `gif_url`;
- matching GIF width and height;
- KLIPY `file.sm.jpg` as a static JPEG thumbnail;
- up to 50 results per answer, with normal offset pagination.[^bot-api-gif]

This keeps the animated native inline gallery and normal one-tap send behavior while avoiding KLIPY's provider MP4 stream layout. It is the lowest-risk observed payload, not a complete fix for the Telegram client bug.

The `sm.gif` experiment also answered the preview/send question: although `thumbnail_url` remained the static `sm.jpg`, gallery tiles were animated. Telegram therefore fetched `gif_url` for animated preview playback. The standard GIF inline-result type offers no separate low-resolution animated GIF preview URL, so it cannot preview `xs.gif` while sending `sm.gif` without introducing an MPEG-4 animated thumbnail or a nonstandard post-send replacement flow.

## Local crash evidence

Installed client:

- Telegram for macOS (native), bundle `ru.keepcoder.Telegram`
- Version 12.9, build 282555
- macOS 26.4.1, Apple Silicon

The official beta URL advertised in Telegram's native-macOS reporting chat currently provides **12.9.1 build 282650**. Its disk image was downloaded, signature-checked, and notarization-checked; reproduction on that build is pending.

The seven reports in `~/Library/Logs/DiagnosticReports/Telegram-*.ips` from July 28–31 all show:

- `EXC_BAD_ACCESS` / `SIGBUS`
- stack-guard failure
- three explicitly say `Thread stack size exceeded due to excessive recursion`
- faulting dispatch queue: `MediaBox-Data`
- the same repeating Telegram binary frame offsets, including `0x1a7b130`, `0x1a59dd4`, `0x1a53a80`, and `0x1a72b6c`

Four additional reports were recorded on August 2–3 before the actual-GIF deployment. The latest of those, at 20:01 on August 3, again faulted on `MediaBox-Data` with the same stack-guard failure. No new crash report appeared during the initial 8-result and 50-result `xs.gif` tests. Controlled experiments later produced matching `MediaBox-Data` stack-guard crashes with both `sm.gif` and `xs.gif`; exact payloads worked after their media URLs were warm.

Telegram's source creates its media-data queue with exactly the name `MediaBox-Data`.[^mediabox-source] This places the failure in Telegram's media resource/cache pipeline, before or around file completion, rather than in a conventional video decoder crash.

The native client log immediately before a reproduction shows:

1. `messages.getInlineBotResults`
2. several parallel `upload.getFile` requests for result media
3. the `MediaBox-Data` stack overflow

The native macOS GIF UI also uses a `SoftwareVideoLayerFrameManager` backed by Telegram's media-resource system.[^gif-buffer-source] An older/alternate GIF player path explicitly selects the first **video** track from the asset.[^gif-player-source] This means an extra audio track violates the Bot API contract but is not, by itself, proof of the observed recursion.

## Current KLIPY media audit

I fetched the first eight current results for each of:

- trending
- `cats`
- `splash`
- `hello`

Then I downloaded and inspected all 32 `sm.mp4` assets with `ffprobe` and decoded every video stream with `ffmpeg -f null`.

### Results

| Property          | Result                                                        |
| ----------------- | ------------------------------------------------------------- |
| Video codec       | 32/32 H.264                                                   |
| Codec tag         | 32/32 `avc1`                                                  |
| Pixel format      | 32/32 `yuv420p`                                               |
| Profiles          | 17 High, 15 Constrained Baseline                              |
| H.264 levels      | 1.1–3.0                                                       |
| Downloaded size   | 4,479–425,004 bytes; median 105,172 bytes                     |
| Duration          | 0.11–6.4 seconds; median 2.25 seconds                         |
| Dimensions        | declared dimensions matched decoded dimensions 32/32          |
| Container layout  | 32/32 `ftyp`, `moov`, `free`, `mdat` (`moov` is front-loaded) |
| Decode test       | 32/32 decoded without FFmpeg errors                           |
| HTTP content type | 32/32 `video/mp4`                                             |
| Audio stream      | **5/32 contained AAC-LC stereo**                              |

All five AAC streams measured approximately `-91 dB` maximum/mean volume (digital silence), but they are still audio streams. Distribution in this sample:

- trending: 1/8
- `cats`: 0/8
- `splash`: 3/8
- `hello`: 1/8

Therefore:

- **Size is very unlikely**: the largest audited MP4 was only about 415 KiB.
- **Chroma format is not the current problem**: all audited videos are the widely compatible `yuv420p`.
- **Container streaming layout is good**: `moov` precedes `mdat` in every file.
- **The MP4 set is not fully API-conforming**: 15.6% had a silent AAC track.

This is a point-in-time sample, not a guarantee for KLIPY's entire or future catalog. The KLIPY v1 response consumed by this project exposes URL, width, height, and size, but not codec, pixel format, or stream metadata, so the bot cannot validate these properties from its current JSON response. KLIPY's newer response-object documentation adds a top-level `hasaudio` flag, but its media metadata still consists of URL, dimensions, duration, and size rather than stream-level probe data.[^klipy-response]

## Ranked hypotheses

### 1. Telegram 12.9 native macOS `MediaBox` synchronous recursion — confirmed client bug

This is directly supported by the local crash reports, controlled cold/warm-cache experiments, and an independent `@GiphyBot` report with the same binary UUID and recurring offsets.[^exact-macos-issue] Reducing from 24 remote MP4 results to 8 still crashed. Fifty `xs.gif` results remained stable, while selected `sm.gif` groups crashed only when media were newly introduced and then worked unchanged once warm. This rules out result count and the MP4 format as sole explanations and directly implicates remote fetch/cache state.

The independent report also identifies the likely source mechanism:

1. SwiftSignalKit's `Queue.async` executes the closure **synchronously** when already on that queue.[^queue-source]
2. `MediaBoxFileContextV2Impl` receives a fetch result on `MediaBox-Data`, calls `processFetchResult`, then `updateRequests`, which can synchronously emit the next buffered chunk.[^mediabox-fetch-source]
3. The next `queue.async` therefore runs inline instead of scheduling a new queue turn, adding one stack frame per chunk until the 544 KiB worker stack reaches its guard page.

That mechanism matches the `MediaBox-Data` queue and repeated four-frame cycle in every local report. It also explains why reducing the number or byte size of results may change frequency without reliably fixing the crash.

Broader online reports also show GIF-panel instability: native Telegram for macOS users report GIFs and stickers loading slowly or failing,[^mac-gif-loading] while Telegram Desktop users have reported crashes during GIF search.[^desktop-gif-crash]

### 2. Contract-invalid silent AAC tracks in KLIPY `sm.mp4` files — medium confidence as a trigger, high confidence as a defect

Telegram requires `mpeg4_gif` media to be H.264 video without sound.[^bot-api] Five of 32 audited assets had AAC tracks. A Telegram client is still responsible for not crashing on malformed bot media, but the bot should not send those files under this result type.

The native player's video-track selection weakens the claim that AAC alone causes this specific stack overflow, so this remains a trigger hypothesis rather than a proven root cause.

### 3. Unsupported chroma/bit depth — low confidence for the sampled results

A current Telegram iOS bug report traces a permanent GIF-panel hang to non-4:2:0 video such as H.264 `yuv444p`; Telegram's decoder recognizes only YUV420/YUVA420 variants in that path.[^unsupported-pixfmt-issue][^telegram-frame-source]

That is a real compatibility hazard for unsanitized third-party MP4s, but all 32 current KLIPY samples were `yuv420p`. It does not explain these reproductions unless another query returns a different rendition.

### 4. Static media properties — ruled out as sole causes

The audited files decode successfully and their declared dimensions match. Controlled groups crossed in both directions: a working group had more frames and decoded pixels than a crashing group, and a 3.097 MB group crashed while larger 3.398–3.446 MB groups worked. Individual members of each crashing group also worked alone. Most importantly, both exact crashing URL sets worked after warming. Size and complexity can affect timing and probability, but no measured static property independently causes the failure.

## Controlled isolation protocol

Normal inline searches remain on the lowest-risk `xs.gif` payload. Diagnostic queries use this syntax:

```text
!test <xs|sm> [fixed] <start 1-50> <count 1-50> <search query>
```

The diagnostic mode always requests KLIPY page 1, selects the specified contiguous subset, disables pagination, gives every result a rendition-and-position-specific ID, and logs GIF and thumbnail metadata. The optional `fixed` token replaces all provider thumbnails with one 162-byte JPEG so animation and thumbnail cold-fetch behavior can be separated. Incomplete or invalid `!test` commands return no media instead of accidentally running an uncontrolled search.

Use one fixed search term and proceed in this order:

1. **Control:** `!test xs 1 1 cats`, then `!test xs 1 50 cats`.
2. **Single-item rendition:** `!test sm 1 1 cats`. If it crashes, compare `xs` and `sm` for that same position and inspect the downloaded files.
3. **Individual-item scan:** test `sm` with count 1 and starts 2–50. This separates a catalog-specific malformed asset from aggregate load.
4. **Concurrency threshold:** if individual `sm` items are stable, test start 1 with counts 2, 4, 8, 16, 32, and 50. Stop at the first crash.
5. **Byte-load versus count:** use logged media sizes to compare equal-count subsets with low and high aggregate bytes.
6. **Cache:** repeat each boundary case once warm and once after clearing Telegram's media cache or using previously unseen result IDs.
7. **Thumbnail:** only after establishing a repeatable boundary, hold the exact media set fixed and vary the thumbnail. The first `xs`/`sm` comparison already held the JPEG thumbnail constant, so this is lower priority.

This protocol can distinguish item-specific failure, rendition-specific failure, result-count threshold, and aggregate-byte correlation. It cannot independently separate dimensions from encoding complexity without generating controlled transcodes of the same source asset.

## Recommended next steps

### Keep and monitor the current mitigation

Continue using KLIPY `file.xs.gif` through `InlineQueryResultGif` with a static JPEG thumbnail. This is currently the best combination of native inline UX and reduced crash frequency, but controlled cold-cache testing proves it is not crash-free.

Before treating the result as conclusive:

1. repeat searches across trending and varied queries on cold and warm Telegram caches;
2. monitor `~/Library/Logs/DiagnosticReports` for new `Telegram-*.ips` files;
3. test on newer native Telegram Mac builds when available;
4. after a longer stable period, restore a modest positive `cache_time` to reduce KLIPY API usage.

If crashes recur, reduce the result count through 8, 4, 2, and 1 while keeping `xs.gif` unchanged, then compare one fixed known-good GIF against one fixed MP4. Change only one axis per deployment.

### Actual-GIF rationale

The implemented mitigation requests KLIPY `gif,jpg` instead of `mp4,jpg` and returns `InlineQueryResultGif` using `file.xs.gif` plus a JPEG thumbnail.

A 32-result audit of the same searches found:

- `xs.gif`: 6,690–461,852 bytes; median 78,989; none over 1 MiB
- `sm.gif`: 20,511–1,293,655 bytes; median 271,414; 2/32 over 1 MiB

The `xs.gif` variant remains the preferred risk-reduction workaround. Telegram documents that actual GIF uploads are converted to soundless MP4, so this also avoids trusting KLIPY's MP4 stream layout.[^telegram-gifs] Both GIF renditions can trigger the cold-fetch bug, but `sm.gif` has reproduced it more readily.

### If MP4 is retained

Do not pass provider MP4s through blindly. Put an audited/cached media layer in front of Telegram and enforce:

```sh
ffmpeg -i input.mp4 \
  -map 0:v:0 -an \
  -c:v libx264 -pix_fmt yuv420p \
  -profile:v main -level 3.1 \
  -movflags +faststart \
  output.mp4
```

For the current catalog, a cheaper remux (`-map 0:v:0 -c:v copy -an -movflags +faststart`) removes silent AAC, but full transcoding protects against future non-4:2:0 or unsupported H.264 variants.

Because Vercel functions are not a good place for on-demand FFmpeg plus durable caching, practical options are:

- ask KLIPY to guarantee soundless H.264/yuv420p MP4 GIF renditions;
- add a small FFmpeg-backed media service with object storage/cache;
- pre-ingest sanitized animations into Telegram and use `InlineQueryResultCachedMpeg4Gif` file IDs.

### Add evidence to the existing Telegram client issue

Do not open a duplicate. Comment on [`overtake/TelegramSwift#1437`](https://github.com/overtake/TelegramSwift/issues/1437), which already reports the identical crash for `@GiphyBot`, with:

- confirmation that a separate KLIPY-backed inline bot reproduces it;
- app 12.9 build 282555 and macOS 26.4.1;
- one sanitized `.ips` report (prepared locally as `/tmp/Telegram-2026-07-31-210235-sanitized.ips`);
- whether 12.9.1 build 282650 still crashes;
- whether one result works and the smallest result count that crashes.

Also post the issue link in Telegram's official native-macOS beta/report chat, because the public source mirror lags the shipped application. The bot can avoid malformed media and reduce concurrency, but a remote inline result must not be able to stack-overflow the client.

## Test matrix and status

| Case | Result count | Media                                           | Status / purpose                                                |
| ---- | -----------: | ----------------------------------------------- | --------------------------------------------------------------- |
| A    |           24 | remote `sm.mp4` as `mpeg4_gif`                  | Failed: crashed                                                 |
| B    |            8 | remote `sm.mp4` as `mpeg4_gif` + JPEG thumbnail | Failed: crashed                                                 |
| C    |            8 | remote `xs.gif` as `gif` + JPEG thumbnail       | Passed in observed testing                                      |
| D    |           50 | remote `xs.gif` as `gif` + JPEG thumbnail       | Passed in observed testing                                      |
| E    |            1 | fixed soundless `sm.mp4`                        | Deferred; isolate MP4 path if crashes recur                     |
| F    |            1 | fixed `sm.mp4` with silent AAC                  | Deferred; isolate audio-track effect                            |
| G    |            8 | JPEG-only article/photo results                 | Deferred; determine whether thumbnail fan-out alone triggers it |
| H    |            8 | cached Telegram `file_id` animations            | Deferred; separate remote fetching from animation playback      |
| I    |           50 | remote `sm.gif` as `gif` + JPEG thumbnail       | Failed: animated previews loaded, then Telegram Mac crashed     |
| J    |          1–5 | controlled cold `sm.gif` subsets                | Mixed: two subsets crashed only while media were newly fetched  |
| K    |          4–5 | exact previously crashing `sm.gif` subsets warm | Passed unchanged after every URL had loaded independently       |
| L    |            4 | cold `xs.gif` + provider JPEG thumbnails        | Failed once at only 351 KB; identical warm repeat passed        |
| M    |          1–4 | fixed 162-byte JPEG thumbnail isolation         | In progress                                                     |

Do not rely on Telegram's five-minute inline cache while testing: change result IDs or temporarily set a very low cache time so each case is actually refreshed.

## Sources

[^bot-api]: Telegram Bot API, [`InlineQueryResultMpeg4Gif`](https://core.telegram.org/bots/api#inlinequeryresultmpeg4gif).

[^bot-api-gif]: Telegram Bot API, [`InlineQueryResultGif`](https://core.telegram.org/bots/api#inlinequeryresultgif) and [`answerInlineQuery`](https://core.telegram.org/bots/api#answerinlinequery), which permits at most 50 results per answer.

[^telegram-gifs]: Telegram API, [Working with GIFs](https://core.telegram.org/api/gifs).

[^mediabox-source]: Telegram macOS dependency source, [`MediaBox.swift` queue declaration](https://github.com/overtake/Telegram-iOS/blob/a24bbe45f9861f736a79916a50898512f751e0dc/submodules/Postbox/Sources/MediaBox.swift#L141-L145).

[^exact-macos-issue]: `overtake/TelegramSwift` issue [#1437, identical `MediaBox-Data` recursion with `@GiphyBot`](https://github.com/overtake/TelegramSwift/issues/1437).

[^queue-source]: Telegram's SwiftSignalKit [`Queue.async` implementation](https://github.com/overtake/Telegram-iOS/blob/a24bbe45f9861f736a79916a50898512f751e0dc/submodules/SSignalKit/SwiftSignalKit/Source/Queue.swift#L60-L66).

[^mediabox-fetch-source]: Telegram's [`MediaBoxFileContextV2Impl` fetch callback](https://github.com/overtake/Telegram-iOS/blob/a24bbe45f9861f736a79916a50898512f751e0dc/submodules/Postbox/Sources/MediaBoxFileContextV2Impl.swift#L352-L367).

[^gif-buffer-source]: Telegram macOS source, [`GifPlayerBufferView.swift`](https://github.com/overtake/TelegramSwift/blob/579cebbf0c01fd41b712eff3647fa7f69db9665d/Telegram-Mac/GifPlayerBufferView.swift#L20-L20) and its [`SoftwareVideoLayerFrameManager` construction](https://github.com/overtake/TelegramSwift/blob/579cebbf0c01fd41b712eff3647fa7f69db9665d/Telegram-Mac/GifPlayerBufferView.swift#L52-L58).

[^gif-player-source]: Telegram macOS source, [`GIFPlayerView.swift` selecting the first video track](https://github.com/overtake/TelegramSwift/blob/579cebbf0c01fd41b712eff3647fa7f69db9665d/packages/TelegramMedia/Sources/GIFPlayerView.swift#L60-L68).

[^klipy-response]: KLIPY official documentation, [Response Object](https://docs.klipy.com/migrate-from-tenor/response-objects/response-object) and [Media Object](https://docs.klipy.com/migrate-from-tenor/response-objects/media-object). KLIPY's [format-size guidance](https://docs.klipy.com/gifs-api/gifs-format-sizes) also lists small MP4s at roughly 98 KB mean / 85 KB median.

[^mac-gif-loading]: `overtake/TelegramSwift` issue [#1209, “Stickies and GIFS extremely slow loading”](https://github.com/overtake/TelegramSwift/issues/1209).

[^desktop-gif-crash]: `telegramdesktop/tdesktop` issue [#24793, “Telegram Desktop randomly crashes when searching for gifs”](https://github.com/telegramdesktop/tdesktop/issues/24793).

[^unsupported-pixfmt-issue]: `TelegramMessenger/Telegram-iOS` issue [#2246, unsupported pixel format causes a GIF-panel infinite loop](https://github.com/TelegramMessenger/Telegram-iOS/issues/2246).

[^telegram-frame-source]: Telegram iOS/macOS-shared media source, [`FFMpegAVFrame.m` supports YUV420/YUVA420 variants and marks others unsupported](https://github.com/TelegramMessenger/Telegram-iOS/blob/6ad963e5b62d354da79040f388ae2b9132fb17b8/submodules/FFMpegBinding/Sources/FFMpegAVFrame.m#L102-L111).
