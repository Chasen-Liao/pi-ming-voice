import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const MING_ENDPOINT = "https://api.ant-ling.com/v1/audio/transcriptions";
export const MING_MODEL = "Ming-3.0-asr-tiny";
export const KEY_ENV_NAME = "ANTLING_API_KEY";
/** 百灵单段音频限制 30 秒，留 2 秒余量。 */
export const DEFAULT_MAX_SECONDS = 28;
/** 上传 + 端点转写共用一个超时，28 秒音频留足余量。 */
export const DEFAULT_TIMEOUT_SECONDS = 90;

/**
 * FFmpeg builds shipped with this package. Each one is a platform package
 * with os/cpu constraints and no install script, so npm installs exactly one
 * of them and no postinstall ever has to run.
 */
const BUNDLED_FFMPEG_PACKAGES = {
  "win32-x64": "@ffmpeg-installer/win32-x64",
  "darwin-arm64": "@ffmpeg-installer/darwin-arm64",
  "darwin-x64": "@ffmpeg-installer/darwin-x64",
  "linux-x64": "@ffmpeg-installer/linux-x64",
  "linux-arm64": "@ffmpeg-installer/linux-arm64",
};

/** Path to the FFmpeg binary that ships with this package, if it is installed. */
export function bundledFfmpegPath() {
  const pkg = BUNDLED_FFMPEG_PACKAGES[`${process.platform}-${process.arch}`];
  if (!pkg) return undefined;
  try {
    const manifest = require.resolve(`${pkg}/package.json`);
    return join(dirname(manifest), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  } catch {
    return undefined;
  }
}

/** True when the given ffmpeg command can be executed. */
export function ffmpegAvailable(ffmpegPath = "ffmpeg") {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(ffmpegPath, ["-version"], { stdio: ["ignore", "ignore", "ignore"], windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      resolve(false);
    }, 5_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/**
 * Pick the FFmpeg to record with: an explicit path the user configured first,
 * then the system ffmpeg, then the binary shipped with this package.
 */
export async function resolveFfmpegPath(configured) {
  const value = typeof configured === "string" ? configured.trim() : "";
  if (value && value !== "ffmpeg" && (value.includes("/") || value.includes("\\")) && existsSync(value)) {
    return value;
  }
  if (await ffmpegAvailable()) return "ffmpeg";
  return bundledFfmpegPath() ?? "ffmpeg";
}

export function defaultAgentDir() {
  return join(homedir(), ".pi", "agent");
}

export function agentPaths(agentDir = defaultAgentDir()) {
  return {
    dir: agentDir,
    configPath: join(agentDir, "ming-voice-stt.json"),
    keyPath: join(agentDir, "antling-api-key"),
  };
}

function platformCapture() {
  if (process.platform === "darwin") return { inputFormat: "avfoundation", input: ":0" };
  if (process.platform === "win32") return { inputFormat: "dshow", input: "audio=Microphone" };
  return { inputFormat: "pulse", input: "default" };
}

export function mingConfig(keyPath) {
  return {
    keybind: "ctrl+r",
    capture: {
      type: "ffmpeg",
      ffmpegPath: "ffmpeg",
      ...platformCapture(),
      sampleRate: 16000,
      channels: 1,
      maxSeconds: DEFAULT_MAX_SECONDS,
    },
    provider: {
      type: "openai-compatible",
      endpoint: MING_ENDPOINT,
      model: MING_MODEL,
      language: "",
      timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      responseFormat: "json",
      apiKeyEnv: KEY_ENV_NAME,
      apiKeyFile: keyPath,
    },
    // 上游 cleanup 是「AI 文本润色」开关，不是临时文件清理。关掉它，识别文本不会外发到第三方。
    cleanup: { enabled: false },
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlaceholderInput(input) {
  const value = typeof input === "string" ? input.trim() : "";
  return value === "" || value === "audio=Microphone" || value === "Microphone";
}

/**
 * 解析令牌文件内容，语义与上游 pi-voice-stt 的 secrets/resolve-api-key.ts 保持一致：
 * - 纯文本（不含 "="）直接当作令牌
 * - 含 "=" 时按 env 文件解析，取 ANTLING_API_KEY=... 那一行
 * 该文件不在本仓库内，两处逻辑必须同步修改。
 */
export function parseApiKeyContents(contents, envName = KEY_ENV_NAME) {
  const raw = String(contents ?? "").trim();
  if (!raw) return "";
  if (!raw.includes("=")) return raw;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separator = normalized.indexOf("=");
    if (separator === -1) continue;
    if (normalized.slice(0, separator).trim() !== envName) continue;
    const value = normalized.slice(separator + 1).trim();
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    return quoted ? quoted[2].trim() : value;
  }
  return "";
}

/** Parse FFmpeg DirectShow listing. FFmpeg 8 uses [in#0 @ addr] "name" (audio). */
export function parseDshowAudioDevices(output) {
  const devices = [];
  let oldAudioSection = false;
  for (const line of String(output).split(/\r?\n/)) {
    if (/DirectShow audio devices/i.test(line)) { oldAudioSection = true; continue; }
    if (/DirectShow video devices/i.test(line)) { oldAudioSection = false; continue; }
    if (/Alternative name/i.test(line)) continue;
    const match = /^\[[^\]]+\]\s+"(.*)"\s*(?:\((audio|video|none)\))?\s*$/u.exec(line);
    if (!match) continue;
    if (match[2] === "audio" || (match[2] === undefined && oldAudioSection)) {
      if (!devices.includes(match[1])) devices.push(match[1]);
    }
  }
  return devices;
}

export function chooseWindowsInput(devices) {
  if (!devices.length) return undefined;
  const preferred = devices.find((name) => /麦克风|microphone|\bmic\b/i.test(name));
  return `audio=${preferred ?? devices[0]}`;
}

/** List DirectShow audio devices. Never rejects: an unavailable ffmpeg yields an empty list. */
export function listWindowsAudioDevices(ffmpegPath = "ffmpeg") {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(ffmpegPath, ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolve([]);
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
    }, 8_000);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(parseDshowAudioDevices(`${stdout}\n${stderr}`));
    });
  });
}

function resolveInput(capture, fallback, detectedInput) {
  const current = typeof capture.input === "string" ? capture.input.trim() : "";
  if (!isPlaceholderInput(current)) return current;
  return detectedInput || current || fallback;
}

export function mergeMingConfig(existing, keyPath, options = {}) {
  const base = mingConfig(keyPath);
  const current = isObject(existing) ? existing : {};
  const capture = isObject(current.capture) ? current.capture : {};
  const currentProvider = isObject(current.provider) ? current.provider : {};
  const maxSeconds = Number.isInteger(capture.maxSeconds) && capture.maxSeconds >= 1 && capture.maxSeconds <= DEFAULT_MAX_SECONDS
    ? capture.maxSeconds
    : DEFAULT_MAX_SECONDS;
  // 60 秒以上才当作用户自己调过；更小的值（含旧版默认的 30）统一抬到 DEFAULT_TIMEOUT_SECONDS。
  const timeoutSeconds = Number.isInteger(currentProvider.timeoutSeconds) && currentProvider.timeoutSeconds >= 60
    ? currentProvider.timeoutSeconds
    : DEFAULT_TIMEOUT_SECONDS;
  const provider = {
    ...currentProvider,
    type: "openai-compatible",
    endpoint: MING_ENDPOINT,
    model: MING_MODEL,
    language: "",
    timeoutSeconds,
    responseFormat: "json",
    apiKeyEnv: KEY_ENV_NAME,
    apiKeyFile: keyPath,
  };
  delete provider.apiKey;
  return {
    ...base,
    ...current,
    keybind: typeof current.keybind === "string" && current.keybind.trim() ? current.keybind : base.keybind,
    capture: {
      ...base.capture,
      ...capture,
      maxSeconds,
      input: resolveInput(capture, base.capture.input, options.detectedInput),
      ffmpegPath: options.ffmpegPath ?? capture.ffmpegPath ?? base.capture.ffmpegPath,
    },
    provider,
    cleanup: { ...(isObject(current.cleanup) ? current.cleanup : {}), enabled: false },
  };
}

export async function ensureMingConfig(agentDir = defaultAgentDir(), options = {}) {
  const paths = agentPaths(agentDir);
  mkdirSync(paths.dir, { recursive: true });
  let existing = {};
  if (existsSync(paths.configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(paths.configPath, "utf8"));
      existing = isObject(parsed) ? parsed : {};
    } catch {
      // A broken config must not take the whole extension down: keep a copy and fall back to defaults.
      const backup = `${paths.configPath}.broken-${Date.now()}`;
      try { renameSync(paths.configPath, backup); } catch { /* best effort */ }
      existing = {};
    }
  }
  const capture = isObject(existing.capture) ? existing.capture : {};
  const ffmpegPath = await resolveFfmpegPath(capture.ffmpegPath);
  let detectedInput = options.detectedInput;
  // Only probe devices while the configured input is still the placeholder, so a
  // resolved device never costs another ffmpeg spawn on every Pi start.
  if (!detectedInput && process.platform === "win32" && isPlaceholderInput(capture.input)) {
    const listDevices = options.listDevices ?? listWindowsAudioDevices;
    detectedInput = chooseWindowsInput(await listDevices(ffmpegPath));
  }
  const next = mergeMingConfig(existing, paths.keyPath, { detectedInput, ffmpegPath });
  writeFileSync(paths.configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return paths;
}

/** Read the current config without writing anything. */
export function readMingConfig(agentDir = defaultAgentDir()) {
  const paths = agentPaths(agentDir);
  if (!existsSync(paths.configPath)) return { paths, config: null, broken: false };
  try {
    const parsed = JSON.parse(readFileSync(paths.configPath, "utf8"));
    return { paths, config: isObject(parsed) ? parsed : null, broken: false };
  } catch {
    return { paths, config: null, broken: true };
  }
}

/** Read the token the way pi-voice-stt will read it, so status never lies about it. */
export function readApiKey(agentDir = defaultAgentDir()) {
  const { keyPath } = agentPaths(agentDir);
  if (!existsSync(keyPath)) return "";
  try {
    return parseApiKeyContents(readFileSync(keyPath, "utf8"), KEY_ENV_NAME);
  } catch {
    return "";
  }
}

export function hasApiKeyFile(agentDir = defaultAgentDir()) {
  return readApiKey(agentDir).length > 0;
}

/**
 * Store the token as an env-style entry. A bare token containing "=" would be
 * parsed as an env file by pi-voice-stt and resolve to an empty key.
 */
export async function writeApiKey(agentDir, key, options = {}) {
  const trimmed = key.trim();
  if (!trimmed || /[\r\n]/.test(key)) {
    throw new Error("API key 不能为空，也不能包含换行");
  }
  const paths = await ensureMingConfig(agentDir, options);
  writeFileSync(paths.keyPath, `${KEY_ENV_NAME}=${trimmed}\n`, { encoding: "utf8", mode: 0o600 });
  return paths;
}
