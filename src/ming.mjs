import { createJiti } from "jiti";
import { createRequire } from "node:module";
import { defaultAgentDir, ensureMingConfig } from "../bin/ming-preset.mjs";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { moduleCache: false });

/** Load pi-voice-stt after pointing it at the Ming preset. The key stays outside this repo. */
export default function mingVoice(pi) {
  const { configPath } = ensureMingConfig(defaultAgentDir());
  process.env.PI_STT_CONFIG = configPath;
  const entry = require.resolve("pi-voice-stt/src/index.ts");
  return jiti.import(entry).then((mod) => {
    const factory = mod.default ?? mod;
    if (typeof factory !== "function") {
      throw new Error("pi-voice-stt 没有可加载的扩展入口");
    }
    return factory(pi);
  });
}
