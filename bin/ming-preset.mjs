import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MING_ENDPOINT = "https://api.ant-ling.com/v1/audio/transcriptions";
export const MING_MODEL = "Ming-3.0-asr-tiny";

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
      maxSeconds: 28,
    },
    provider: {
      type: "openai-compatible",
      endpoint: MING_ENDPOINT,
      model: MING_MODEL,
      language: "",
      timeoutSeconds: 30,
      responseFormat: "json",
      apiKeyEnv: "ANTLING_API_KEY",
      apiKeyFile: keyPath,
    },
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

export function listWindowsAudioDevices(ffmpegPath = "ffmpeg") {
  const result = spawnSync(ffmpegPath, [
    "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy",
  ], { encoding: "utf8", windowsHide: true, timeout: 8_000 });
  if (result.error) return [];
  return parseDshowAudioDevices(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
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
  const maxSeconds = Number.isInteger(capture.maxSeconds) && capture.maxSeconds >= 1 && capture.maxSeconds <= 28
    ? capture.maxSeconds
    : 28;
  const provider = {
    ...(isObject(current.provider) ? current.provider : {}),
    type: "openai-compatible",
    endpoint: MING_ENDPOINT,
    model: MING_MODEL,
    language: "",
    timeoutSeconds: 30,
    responseFormat: "json",
    apiKeyEnv: "ANTLING_API_KEY",
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
    },
    provider,
    cleanup: { ...(isObject(current.cleanup) ? current.cleanup : {}), enabled: false },
  };
}

export function ensureMingConfig(agentDir = defaultAgentDir(), options = {}) {
  const paths = agentPaths(agentDir);
  mkdirSync(paths.dir, { recursive: true });
  let existing = {};
  if (existsSync(paths.configPath)) {
    existing = JSON.parse(readFileSync(paths.configPath, "utf8"));
  }
  const ffmpegPath = isObject(existing.capture) && typeof existing.capture.ffmpegPath === "string"
    ? existing.capture.ffmpegPath
    : "ffmpeg";
  const detectedInput = options.detectedInput
    ?? (process.platform === "win32" ? chooseWindowsInput(listWindowsAudioDevices(ffmpegPath)) : undefined);
  const next = mergeMingConfig(existing, paths.keyPath, { detectedInput });
  writeFileSync(paths.configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return paths;
}

export function writeApiKey(agentDir, key) {
  const trimmed = key.trim();
  if (!trimmed || /[\r\n]/.test(key)) {
    throw new Error("API key 不能为空，也不能包含换行");
  }
  const paths = ensureMingConfig(agentDir);
  writeFileSync(paths.keyPath, `${trimmed}\n`, { encoding: "utf8", mode: 0o600 });
  return paths;
}

export function hasApiKeyFile(agentDir = defaultAgentDir()) {
  const { keyPath } = agentPaths(agentDir);
  if (!existsSync(keyPath)) return false;
  return readFileSync(keyPath, "utf8").trim().length > 0;
}
