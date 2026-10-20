# AGENTS.md

当前插件只有一条路径：`src/ming.ts` 由 Pi 自己的 loader 加载 `pi-voice-stt`，把识别端点固定到蚂蚁百灵 `Ming-3.0-asr-tiny`。

不要恢复已删除的自研录音器、旧计划或 Esc 自动发送方案。令牌只放在用户目录的 key 文件或 `ANTLING_API_KEY`，不要写进源码、样例、日志或提交。

## 约束

- 扩展入口必须是 TypeScript，并且交给 Pi 的 loader 加载。不要在插件里自己 new 一个 jiti：Pi 装包时跳过 peerDependencies，自建 loader 找不到宿主的 `@earendil-works/*`，扩展会在载入时直接失败。
- `bin/ming-preset.mjs` 要能被纯 Node 的 CLI 直接运行，所以不要在里面 import `.ts`。
- 令牌文件按 `ANTLING_API_KEY=<令牌>` 一行存放。裸令牌一旦含 `=`，pi-voice-stt 会按 env 文件解析并得到空值。
- `bin/ming-preset.mjs` 里的令牌解析逻辑必须与 pi-voice-stt 的 `secrets/resolve-api-key.ts` 保持一致。
- 配置解析失败不能让扩展加载失败，坏文件备份后回退默认值。
- 未实测的行为不要写成已经跑通。
