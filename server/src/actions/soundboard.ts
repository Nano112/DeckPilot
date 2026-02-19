import type { SoundboardManager } from "../services/soundboard";

export function createSoundboardHandlers(soundboard: SoundboardManager) {
  return {
    play: async (params: { soundId?: string }) => {
      if (!params.soundId) throw new Error("Missing soundId");
      await soundboard.play(params.soundId);
    },
    stop: async (params: { soundId?: string }) => {
      if (params.soundId) {
        await soundboard.stopSound(params.soundId);
      } else {
        await soundboard.stop();
      }
    },
    setVolume: async (params: { target?: string; level?: number }) => {
      if (!params.target || params.level === undefined) throw new Error("Missing target or level");
      await soundboard.setVolume(params.target, params.level);
    },
  };
}
