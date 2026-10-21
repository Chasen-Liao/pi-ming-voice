import {
  CONSOLE_URL,
  defaultAgentDir,
  ensureMingConfig,
  hasApiKeyFile,
  MING_ENDPOINT,
  MING_MODEL,
  openPage,
  readApiKey,
  readMingConfig,
  writeApiKey,
} from "../bin/ming-preset.mjs";
import voiceStt from "pi-voice-stt/src/index.ts";

type Pi = Parameters<typeof voiceStt>[0];
type CommandContext = {
  hasUI?: boolean;
  ui: {
    notify(message: string, type?: "info" | "warning" | "error"): void;
    input(title: string, placeholder?: string): Promise<string | undefined>;
  };
};

/** `/ming` keeps the token setup inside Pi, so no separate terminal is needed. */
function registerMingCommand(pi: Pi): void {
  pi.registerCommand("ming", {
    description: "百灵语音设置：key 填写令牌，status 查看状态，open 打开令牌控制台",
    getArgumentCompletions: (prefix: string) => ["key", "status", "open"]
      .filter((action) => action.startsWith(prefix.trim().toLowerCase()))
      .map((value) => ({ value, label: value })),
    handler: async (args: string, ctx: CommandContext) => {
      const action = (args.trim().split(/\s+/, 1)[0] ?? "").toLowerCase();

      if (action === "open") {
        openPage(CONSOLE_URL);
        ctx.ui.notify(`已打开百灵控制台：${CONSOLE_URL}`, "info");
        return;
      }

      if (action === "status") {
        const { paths, config, broken } = readMingConfig();
        const key = readApiKey();
        if (broken) ctx.ui.notify(`配置文件已损坏：${paths.configPath}`, "warning");
        ctx.ui.notify(`端点 ${MING_ENDPOINT} · 模型 ${MING_MODEL}`, "info");
        if (config) {
          ctx.ui.notify(
            `设备 ${config.capture?.input ?? "未设置"} · 上限 ${config.capture?.maxSeconds ?? "?"} 秒 · 超时 ${config.provider?.timeoutSeconds ?? "?"} 秒`,
            "info",
          );
        }
        ctx.ui.notify(
          key
            ? `令牌已就绪（${paths.keyPath}），识别可用。`
            : `令牌还没填好（${paths.keyPath}），运行 /ming key 填写。`,
          key ? "info" : "warning",
        );
        return;
      }

      if (action !== "key") {
        ctx.ui.notify("用法：/ming key（填令牌） · /ming status（看状态） · /ming open（打开控制台）", "info");
        return;
      }

      if (!ctx.hasUI) {
        ctx.ui.notify("当前不是交互模式，请在终端运行 npx ming-voice key。", "warning");
        return;
      }

      openPage(CONSOLE_URL);
      ctx.ui.notify("已打开百灵控制台，创建令牌后粘贴到下面的输入框。", "info");
      const key = await ctx.ui.input("粘贴百灵 API 令牌", "在 chat.ant-ling.com/open 创建");
      if (!key) {
        ctx.ui.notify("已取消，令牌没有改动。", "warning");
        return;
      }
      try {
        const paths = await writeApiKey(defaultAgentDir(), key.trim());
        ctx.ui.notify(`令牌已保存到 ${paths.keyPath}，立即生效，不用重启 Pi。`, "info");
      } catch (error) {
        ctx.ui.notify(`保存失败：${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });
}

/**
 * Pi loads this module through its own jiti, so pi-voice-stt and its
 * `@earendil-works/*` imports resolve against the host's module mapping.
 * Do not spawn a second loader here: Pi installs packages with
 * `--legacy-peer-deps`, so a private loader would not find the host packages.
 */
export default function mingVoice(pi: Pi) {
  return ensureMingConfig(defaultAgentDir()).then(({ configPath }) => {
    // pi-voice-stt reads PI_STT_CONFIG when the factory runs, not at import time.
    process.env.PI_STT_CONFIG = configPath;
    registerMingCommand(pi);
    return voiceStt(pi);
  });
}
