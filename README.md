# pi-ming-voice

Pi 语音输入。录音和回填使用 [pi-voice-stt](https://github.com/cgarrot/pi-voice-stt)，识别端点固定为蚂蚁百灵 `Ming-3.0-asr-tiny`。

2026-10-20 已在本机交互式 Pi 里实测可用，识别准确。没有单独测量耗时或长录音上限。

## 安装

```powershell
pi install npm:pi-ming-voice
```

本机开发目录也可以：

```powershell
pi install D:\MyProjects\pi-ming-voice
```

需要本机已有 FFmpeg。插件不会下载或安装它。

## 填写令牌

```powershell
npx ming-voice login
```

这会打开 [百灵 API 控制台](https://chat.ant-ling.com/open)。登录后点「创建令牌」，再把令牌贴回终端。官方没有自动回传令牌的接口。充值在 [支付宝小程序云计费中心](https://feecenter.cloud.alipay.com/console/feeMain)。

已经有令牌时运行 `npx ming-voice key`。输入不回显，只写到本机 `%USERPROFILE%\.pi\agent\antling-api-key`，不进仓库。`ANTLING_API_KEY` 环境变量仍然优先。

## 使用

重启 Pi 后：

| 操作 | 作用 |
| --- | --- |
| `Ctrl+R` | 开始录音；再按一次停止、识别，并把文字插入输入框 |
| 录音中按 Enter | 识别后直接发送 |
| Esc | 放弃本轮 |
| `/stt doctor` | 检查配置、令牌和 FFmpeg |

Windows 上如果设备名仍是占位的 `audio=Microphone`，加载时会用 FFmpeg 列出 DirectShow 设备，并优先选择名字里带「麦克风」的输入。手改过的 `capture.input` 不会被覆盖。单段录音上限 28 秒。

更细的说明见 [docs/USAGE.md](docs/USAGE.md)。
