# 使用说明

识别地址是 `https://api.ant-ling.com/v1/audio/transcriptions`，模型是 `Ming-3.0-asr-tiny`。不传 `language`。录音上限 28 秒，避免超过官方 30 秒限制。

## 令牌

```powershell
npx ming-voice login
```

打开 https://chat.ant-ling.com/open ，创建令牌后贴回终端。充值页面是 https://feecenter.cloud.alipay.com/console/feeMain 。

`npx ming-voice status` 只显示端点和令牌是否已填写，不显示令牌本身。

令牌文件：`%USERPROFILE%\.pi\agent\antling-api-key`  
配置文件：`%USERPROFILE%\.pi\agent\ming-voice-stt.json`

## 录音

| 操作 | 作用 |
| --- | --- |
| `Ctrl+R` | 开始；再按一次识别并插入输入框 |
| 录音中按 Enter | 识别后直接发送 |
| Esc | 放弃 |
| `/stt doctor` | 检查 FFmpeg、配置和令牌 |

Windows 占位设备名 `audio=Microphone` 会在准备配置时自动换成列出的麦克风。已经手改的 `capture.input` 保留。
