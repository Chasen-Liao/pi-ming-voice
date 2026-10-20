import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  chooseWindowsInput,
  ensureMingConfig,
  MING_ENDPOINT,
  MING_MODEL,
  mergeMingConfig,
  parseDshowAudioDevices,
  writeApiKey,
} from "../bin/ming-preset.mjs";

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
  const detected = mergeMingConfig({
    capture: { input: "audio=Microphone" },
  }, "C:/keys/antling-api-key", { detectedInput: "audio=本机麦克风" });
  assert.equal(detected.capture.input, "audio=本机麦克风");
  assert.equal(merged.capture.maxSeconds, 28);
  assert.equal(JSON.stringify(merged).includes("secret-value"), false);
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
    const paths = writeApiKey(dir, "test-key-value");
    assert.equal(paths.dir, dir);
    const key = await readFile(paths.keyPath, "utf8");
    const config = await readFile(paths.configPath, "utf8");
    assert.equal(key.trim(), "test-key-value");
    assert.equal(config.includes("test-key-value"), false);
    assert.equal(config.includes(MING_ENDPOINT), true);
    const again = ensureMingConfig(dir);
    const kept = JSON.parse(await readFile(again.configPath, "utf8"));
    assert.equal(kept.provider.endpoint, MING_ENDPOINT);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
