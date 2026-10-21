# pi-ming-voice

Pi 语音输入。录音和回填使用 [pi-voice-stt](https://github.com/cgarrot/pi-voice-stt)，识别端点固定为蚂蚁百灵 `Ming-3.0-asr-tiny`。

## 安装

```powershell
pi install npm:pi-ming-voice
```

本机开发目录也可以（Pi 会把本地目录当扩展包加载，改代码即时生效）：

```powershell
pi install <你的仓库路径>
```

需要本机已有 FFmpeg，以及 Node ≥ 22.19。插件不会下载或安装它们。

> 请通过 `pi install` 安装。Pi 装扩展包时会跳过 peerDependencies，`@earendil-works/*` 由 Pi 自己在运行时提供；用普通 `npm i` 安装会得到另一份副本的 Pi 运行时包。

## 填写令牌

```powershell
npx ming-voice login
```

这会打开 [百灵 API 控制台](https://chat.ant-ling.com/open)。登录后点「创建令牌」，再把令牌贴回终端。官方没有自动回传令牌的接口。充值在 [支付宝小程序云计费中心](https://feecenter.cloud.alipay.com/console/feeMain)。

已经有令牌时运行 `npx ming-voice key`。输入不回显，只写到本机 `%USERPROFILE%\.pi\agent\antling-api-key`，不进仓库。`ANTLING_API_KEY` 环境变量仍然优先。

`npx ming-voice status` 是只读的：打印端点、设备、超时和令牌是否可解析，不会改配置。

## 使用

重启 Pi 后：

| 操作 | 作用 |
| --- | --- |
| `Ctrl+R` | 开始录音；再按一次停止、识别，并把文字插入输入框 |
| 录音中按 Enter | 识别后直接发送 |
| Esc | 放弃本轮（录音中丢弃录音，转写中中止请求） |
| `Alt+R` | 上游自带的 profile 切换菜单，本插件只有一个 profile |
| `/stt doctor` | 检查配置、令牌和 FFmpeg；不测网络，也不测麦克风是否真的能录到声音 |

上游的界面文案目前只有英文和法文，插件里的提示是英文。

Windows 上如果设备名仍是占位的 `audio=Microphone`，加载时会用 FFmpeg 列出 DirectShow 设备，并优先选择名字里带「麦克风」的输入。手改过的 `capture.input` 不会被覆盖，也不会重复检测设备。单段录音目标 28 秒，避免超过官方 30 秒限制；这是 JS 定时停止，不是 FFmpeg 的硬时长参数，停止是异步的，实际时长可能略超。

`Ctrl+R` 与 Pi 内置的 `app.session.rename`（重命名会话）同键，在会话树等界面里按它会重命名会话，不是录音。

## 音频会被发到哪里

识别请求发往 `https://api.ant-ling.com/v1/audio/transcriptions`，模型 `Ming-3.0-asr-tiny`，不传 `language`。

除了录音，pi-voice-stt 还注册了一个 `transcribe_audio` 工具和 `/stt file <路径>` 命令。**这两个入口都会读取本地音频文件并上传到同一个第三方端点**，Agent 可以主动调用它们。装了这个插件就等于允许把本地音频传出本机。

更细的说明见 [docs/USAGE.md](docs/USAGE.md)。

## 验证状态

2026-10-21 在 Windows 11、Pi 1.3.0、FFmpeg 8.1.1 的交互式 Pi 里实测通过：`Ctrl+R` 录音 → 百灵识别 → 文字插入输入框，链路正常。识别请求已确认为发往 `https://api.ant-ling.com/v1/audio/transcriptions`，模型 `Ming-3.0-asr-tiny`。

没有单独测量端到端耗时或长录音上限。自动化测试覆盖配置合并、令牌读写与解析、坏配置恢复和设备检测短路。
