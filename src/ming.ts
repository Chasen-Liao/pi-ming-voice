import { defaultAgentDir, ensureMingConfig } from "../bin/ming-preset.mjs";
import voiceStt from "pi-voice-stt/src/index.ts";

/**
 * Pi loads this module through its own jiti, so pi-voice-stt and its
 * `@earendil-works/*` imports resolve against the host's module mapping.
 * Do not spawn a second loader here: Pi installs packages with
 * `--legacy-peer-deps`, so a private loader would not find the host packages.
 */
export default function mingVoice(pi: Parameters<typeof voiceStt>[0]) {
  return ensureMingConfig(defaultAgentDir()).then(({ configPath }) => {
    // pi-voice-stt reads PI_STT_CONFIG when the factory runs, not at import time.
    process.env.PI_STT_CONFIG = configPath;
    return voiceStt(pi);
  });
}
