#!/usr/bin/env node
import { spawn } from "node:child_process";
import { stdin, stdout } from "node:process";
import { defaultAgentDir, ensureMingConfig, hasApiKeyFile, MING_ENDPOINT, MING_MODEL, writeApiKey } from "./ming-preset.mjs";

const consoleUrl = "https://chat.ant-ling.com/open";
const billingUrl = "https://feecenter.cloud.alipay.com/console/feeMain";

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || !stdin.setRawMode) {
      reject(new Error("请在交互式终端运行，这样输入的 key 不会显示在屏幕上"));
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const stop = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (chunk) => {
      const text = String(chunk);
      if (text === "\u0003") {
        stop();
        stdout.write("\n");
        reject(new Error("已取消"));
        return;
      }
      if (text === "\r" || text === "\n") {
        stop();
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (text === "\u007f" || text === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (text < " ") return;
      value += text;
    };
    stdin.on("data", onData);
  });
}

function openBrowser(url) {
  const child = process.platform === "win32"
    ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" });
  child.unref();
}

async function savePastedKey() {
  const key = await readSecret("把控制台里新建的令牌贴到这里（输入不回显）：");
  const paths = writeApiKey(defaultAgentDir(), key);
  console.log(`已保存到 ${paths.keyPath}`);
  console.log(`Pi 配置：${paths.configPath}`);
  console.log("令牌不会从百灵页面自动返回。Ctrl+R 开始录音，再按一次插入文字。");
}

function printStatus() {
  const paths = ensureMingConfig();
  console.log(`识别端点：${MING_ENDPOINT}`);
  console.log(`模型：${MING_MODEL}`);
  console.log(`配置：${paths.configPath}`);
  console.log(`API key 文件：${hasApiKeyFile() ? "已填写" : "还没有"}（${paths.keyPath}）`);
  console.log("key 不会写进仓库，也不会在这里显示。");
}

const command = process.argv[2] ?? "help";

if (command === "status") {
  printStatus();
} else if (command === "login") {
  openBrowser(consoleUrl);
  console.log(`已打开百灵 API 控制台：${consoleUrl}`);
  console.log("在页面登录后点「创建令牌」，再把令牌贴回来。页面不会自动把令牌送回本程序。");
  console.log(`充值在另一个页面：${billingUrl}`);
  await savePastedKey();
} else if (command === "key") {
  await savePastedKey();
} else {
  console.log(`用法：
  ming-voice login    打开百灵控制台，再贴回新建的令牌
  ming-voice key      只贴令牌，不打开浏览器
  ming-voice status   查看端点和 key 是否已填写

识别请求发往 ${MING_ENDPOINT}，模型 ${MING_MODEL}。
进程环境里的 ANTLING_API_KEY 仍然优先于 key 文件。`);
}
