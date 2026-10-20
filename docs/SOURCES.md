# 来源与待核验事项

记录日期：2026-10-20

## 本机检查结果

- 通过 `pi.ps1` 启动器确认当前安装包为 `@earendil-works/pi-coding-agent`
- 已读取本机 `package.json`，版本为 **1.3.0**；这只表示当前本机版本，不表示已核验全网最新版本
- 已读取随包公开 docs 和 TypeScript 声明，包含 `registerCommand`、`registerShortcut`、`ctx.ui.getEditorText()`、`ctx.ui.setEditorText()`、`ctx.ui.onTerminalInput()` 和 `session_shutdown`
- 以上支持插件入口与编辑器交互方案，但事件拦截顺序、快捷键冲突和停止录音交互仍须运行验证
- `Get-Command ffmpeg` 能找到 FFmpeg，尚未列出或访问麦克风设备

本机参考目录：`C:\nvm4w\nodejs\node_modules\@earendil-works\pi-coding-agent`

公开上游入口：

- [Pi extensions 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Pi extension 类型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)
- [Pi packages 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

实施时以目标安装版本的声明为准。记录这些入口不表示本轮已在线核验其全部内容。

## 活动与测试材料

原始工作区：`D:\Tutti`

| 材料 | 本地位置（相对 Tutti 根目录） | 用途 |
| --- | --- | --- |
| 初始 Brief 与工具包盘点 | `活动/Ming-3.0音频模型家族/2026-10-20-Ming-3.0活动Brief与素材盘点.md` | 初始需求与资料边界，部分状态早于后续导入 |
| 同步材料索引 | `活动/Ming-3.0音频模型家族/2026-10-20-Ming-3.0音频模型家族-同步材料索引.md` | 导入来源与非本人实测说明 |
| 活动归档 | `活动/Ming-3.0音频模型家族/raw/tutti-sync-2026-10-20/new-studio-47e61369-brief.md` | Create 要求与审核流程 |
| A/B 候选稿 | `活动/Ming-3.0音频模型家族/raw/tutti-sync-2026-10-20/ming-3.0/drafts.md` | 写作候选，含占位和 Mac/Linux 命令，不能直接视为已完成 |
| box 测试记录 | `活动/Ming-3.0音频模型家族/raw/tutti-sync-2026-10-20/ming-3.0/test-2026-10-20/README.md` | 导入接口行为与错误格式 |
| ASR 文档快照 | `活动/Ming-3.0音频模型家族/raw/tutti-sync-2026-10-20/ming-3.0/src/al-zh-CN_docs_api-reference_audio_asr.txt` | 请求字段与输入限制参考 |

## 网络入口与实现前复核

- [Tutti 活动页](https://tutti.so/c/ming-3-0-a7bf1a8d-6f04-402b-a3a2-44787389822c)
- [百灵 ASR 文档](https://developer.ant-ling.com/zh-CN/docs/api-reference/audio/asr)
- API 候选 base：`https://api.ant-ling.com/v1`
- ASR 候选请求：`POST /audio/transcriptions`，模型 `Ming-3.0-asr-tiny`
- 候选认证环境变量：`ANTLING_API_KEY`
- 导入测试提示 multipart 文件项需正确携带音频 MIME，例如 `audio/wav`
- 归档限制为单段不超过 30 秒 / 10 MB；实施时先复核官方口径，再将限制与输出格式落实到客户端
- 文档里的 `prompt` 为前文转写上下文，不能直接承诺是热词表或能提高识别率

上一轮公开网页读取未成功，本轮计划没有把归档规则写成实时后台确认。实际调用前复核 endpoint、模型可用性、限制与计费；投稿前复核活动窗口、额度、审核和必带信息。
