import type { DiscordSource } from "../services/sources/discord";

export function createDiscordHandlers(discord: DiscordSource) {
  return {
    toggleMute: async () => {
      const settings = await discord.sendCommand("GET_VOICE_SETTINGS", {});
      await discord.sendCommand("SET_VOICE_SETTINGS", {
        mute: !(settings.mute as boolean),
      });
    },
    toggleDeafen: async () => {
      const settings = await discord.sendCommand("GET_VOICE_SETTINGS", {});
      await discord.sendCommand("SET_VOICE_SETTINGS", {
        deaf: !(settings.deaf as boolean),
      });
    },
    disconnect: async () => {
      await discord.sendCommand("SELECT_VOICE_CHANNEL", {
        channel_id: null,
        force: true,
      });
    },
  };
}
