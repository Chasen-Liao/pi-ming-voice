import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  bundledFfmpegPath,
  chooseWindowsInput,
  ensureMingConfig,
  ffmpegAvailable,
  hasApiKeyFile,
  MING_ENDPOINT,
  MING_MODEL,
  mergeMingConfig,
  parseApiKeyContents,
  parseDshowAudioDevices,
  readApiKey,
  resolveFfmpegPath,
  writeApiKey,
} from "../bin/ming-preset.mjs";

const detected = { detectedInput: "audio=本机麦克风" };

test("merge keeps a chosen device and forces the Ming endpoint", () => {
  const merged = mergeMingConfig({
    capture: { input: "audio=本机麦克风", maxSeconds: 120 },
    provider: { apiKey: "secret-value", endpoint: "https://example.invalid" },
  }, "C:/keys/antling-api-key");
  assert.equal(merged.provider.endpoint, MING_ENDPOINT);
  assert.equal(merged.provider.model, MING_MODEL);
  assert.equal(merged.provider.apiKeyFile, "C:/keys/antling-api-key");
  assert.equal(merged.provider.language, "");
  assert.equal("apiKey" in merged.provider, false);
  assert.equal(merged.capture.input, "audio=本机麦克风");
  const detectedMerge = mergeMingConfig({
    capture: { input: "audio=Microphone" },
  }, "C:/keys/antling-api-key", { detectedInput: "audio=本机麦克风" });
  assert.equal(detectedMerge.capture.input, "audio=本机麦克风");
  assert.equal(merged.capture.maxSeconds, 28);
  assert.equal(JSON.stringify(merged).includes("secret-value"), false);
});

test("request timeout defaults to 90s, keeps a large user value and migrates the old 30s default", () => {
  assert.equal(mergeMingConfig({}, "C:/keys/antling-api-key").provider.timeoutSeconds, 90);
  assert.equal(mergeMingConfig({ provider: { timeoutSeconds: 150 } }, "C:/keys/antling-api-key").provider.timeoutSeconds, 150);
  assert.equal(mergeMingConfig({ provider: { timeoutSeconds: 30 } }, "C:/keys/antling-api-key").provider.timeoutSeconds, 90);
  assert.equal(mergeMingConfig({ provider: { timeoutSeconds: 3 } }, "C:/keys/antling-api-key").provider.timeoutSeconds, 90);
});

test("FFmpeg 8 device listing prefers a microphone over video devices", () => {
  const names = parseDshowAudioDevices([
    '[in#0 @ 1] "USB Camera" (video)',
    '[in#0 @ 1] "本机麦克风 (英特尔)" (audio)',
    '[in#0 @ 1]   Alternative name "@secret"',
    '[dshow @ 1] DirectShow audio devices',
    '[dshow @ 1] "备用麦克风"',
  ].join("\n"));
  assert.deepEqual(names, ["本机麦克风 (英特尔)", "备用麦克风"]);
  assert.equal(chooseWindowsInput(names), "audio=本机麦克风 (英特尔)");
});

test("key file is written outside the supplied directory contents of the config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    const paths = await writeApiKey(dir, "test-key-value", detected);
    assert.equal(paths.dir, dir);
    const key = await readFile(paths.keyPath, "utf8");
    const config = await readFile(paths.configPath, "utf8");
    assert.equal(key.trim(), "ANTLING_API_KEY=test-key-value");
    assert.equal(config.includes("test-key-value"), false);
    assert.equal(config.includes(MING_ENDPOINT), true);
    const again = await ensureMingConfig(dir, detected);
    const kept = JSON.parse(await readFile(again.configPath, "utf8"));
    assert.equal(kept.provider.endpoint, MING_ENDPOINT);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a token containing '=' survives a write/read round trip", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    const paths = await writeApiKey(dir, "sk-abc==", detected);
    assert.equal((await readFile(paths.keyPath, "utf8")).trim(), "ANTLING_API_KEY=sk-abc==");
    assert.equal(readApiKey(dir), "sk-abc==");
    assert.equal(hasApiKeyFile(dir), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("token files are parsed like pi-voice-stt parses them", () => {
  assert.equal(parseApiKeyContents("sk-plain"), "sk-plain");
  assert.equal(parseApiKeyContents("ANTLING_API_KEY=sk-env"), "sk-env");
  assert.equal(parseApiKeyContents("# note\nANTLING_API_KEY=sk-env\n"), "sk-env");
  assert.equal(parseApiKeyContents('ANTLING_API_KEY="sk-quoted"'), "sk-quoted");
  assert.equal(parseApiKeyContents(""), "");
});

test("a bare token file containing '=' is reported as unusable, not as filled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    await writeFile(join(dir, "antling-api-key"), "sk-abc==\n", "utf8");
    assert.equal(readApiKey(dir), "");
    assert.equal(hasApiKeyFile(dir), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a broken config file is backed up instead of breaking the extension", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    await writeFile(join(dir, "ming-voice-stt.json"), '{ "capture": { "input": "audio=X" ', "utf8");
    const paths = await ensureMingConfig(dir, detected);
    const config = JSON.parse(await readFile(paths.configPath, "utf8"));
    assert.equal(config.capture.input, "audio=本机麦克风");
    const backups = (await readdir(dir)).filter((name) => name.includes(".broken-"));
    assert.equal(backups.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a resolved device is not re-detected on later starts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    let scans = 0;
    const listDevices = async () => {
      scans += 1;
      return ["别的麦克风"];
    };
    await ensureMingConfig(dir, { listDevices, detectedInput: "audio=本机麦克风" });
    assert.equal(scans, 0);
    await ensureMingConfig(dir, { listDevices });
    assert.equal(scans, 0, "设备已确定，不应再次扫描");
    const config = JSON.parse(await readFile(join(dir, "ming-voice-stt.json"), "utf8"));
    assert.equal(config.capture.input, "audio=本机麦克风");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a placeholder device is detected on Windows", { skip: process.platform !== "win32" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    let scans = 0;
    const listDevices = async () => {
      scans += 1;
      return ["备用麦克风"];
    };
    await ensureMingConfig(dir, { listDevices });
    assert.equal(scans, 1);
    const config = JSON.parse(await readFile(join(dir, "ming-voice-stt.json"), "utf8"));
    assert.equal(config.capture.input, "audio=备用麦克风");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ffmpeg falls back to the bundled binary when the system has none", async () => {
  const savedPath = process.env.PATH;
  try {
    process.env.PATH = join(tmpdir(), "ming-voice-no-ffmpeg");
    assert.equal(await ffmpegAvailable(), false);
    const chosen = await resolveFfmpegPath(undefined);
    const bundled = bundledFfmpegPath();
    if (bundled) {
      assert.equal(chosen, bundled);
      assert.equal(existsSync(chosen), true);
    } else {
      assert.equal(chosen, "ffmpeg");
    }
  } finally {
    process.env.PATH = savedPath;
  }
});

test("an explicitly configured ffmpeg path wins over the bundled one", async () => {
  const bundled = bundledFfmpegPath();
  if (!bundled) return;
  assert.equal(await resolveFfmpegPath(bundled), bundled);
  assert.equal(await resolveFfmpegPath(join(tmpdir(), "ming-voice-missing-ffmpeg")), "ffmpeg");
});

test("the resolved ffmpeg path is written into the config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ming-voice-"));
  try {
    const expected = await resolveFfmpegPath(undefined);
    await ensureMingConfig(dir, { detectedInput: "audio=本机麦克风" });
    const config = JSON.parse(await readFile(join(dir, "ming-voice-stt.json"), "utf8"));
    assert.equal(config.capture.ffmpegPath, expected);
    assert.ok(config.capture.ffmpegPath.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
