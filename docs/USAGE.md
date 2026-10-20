# 使用说明

识别地址是 `https://api.ant-ling.com/v1/audio/transcriptions`，模型是 `Ming-3.0-asr-tiny`。不传 `language`。录音目标 28 秒，避免超过官方 30 秒限制。

## 令牌

```powershell
npx ming-voice login
```

打开 https://chat.ant-ling.com/open ，创建令牌后贴回终端。充值页面是 https://feecenter.cloud.alipay.com/console/feeMain 。

`npx ming-voice status` 是只读的，显示端点、录音设备、超时和令牌是否可解析，不显示令牌本身。

令牌文件：`%USERPROFILE%\.pi\agent\antling-api-key`，按 `ANTLING_API_KEY=<令牌>` 一行存放。  
配置文件：`%USERPROFILE%\.pi\agent\ming-voice-stt.json`

进程环境里的 `ANTLING_API_KEY` 优先于令牌文件。

## 录音

| 操作 | 作用 |
| --- | --- |
| `Ctrl+R` | 开始；再按一次识别并插入输入框 |
| 录音中按 Enter | 识别后直接发送 |
| Esc | 放弃（录音中丢弃录音，转写中中止请求） |
| `Alt+R` | 上游的 profile 菜单，本插件只有一个 profile |
| `/stt doctor` | 检查 FFmpeg、配置和令牌；不测网络，也不测麦克风实际录音 |

界面提示是英文，上游只内置 en 和 fr 两种语言。

Windows 占位设备名 `audio=Microphone` 会在准备配置时自动换成列出的麦克风。已经手改的 `capture.input` 保留，并且不会再重复检测设备。

28 秒是 JS 定时停止目标，停止是异步的，实际音频可能略长于 28 秒；FFmpeg 没有设置硬时长参数。请求超时默认 90 秒，覆盖上传和端点转写。

## 音频去向

`transcribe_audio` 工具和 `/stt file <路径>` 命令都会把本地音频上传到上面那个端点，Agent 可以主动调用。录音本身也只在本机采集，识别时才发出去。

## 配置字段

配置文件由插件维护，`capture`、`provider` 里的端点、模型、语言、key 路径会被强制固定，其余字段（`keybind`、`capture.maxSeconds`、`provider.timeoutSeconds`、`output`、`profiles` 等）保留手改值。

`cleanup.enabled` 是上游的 AI 文本润色开关，不是临时文件清理；插件强制关闭它，识别文本不会被送去润色。临时录音由 pi-voice-stt 在停止、取消和退出时删除。
