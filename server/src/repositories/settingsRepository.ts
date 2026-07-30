import { sqlite } from '../db/database.js';
import {
  appSettingsSchema,
  defaultSettings,
  ensureProfiles,
  mergeSettingsPatch,
  toPublicSettings,
  type AppSettings,
  type PublicAppSettings,
} from '../runtime/settingsTypes.js';

const SETTINGS_ID = 'default';

export const SettingsRepository = {
  get(): AppSettings {
    const row = sqlite
      .prepare(`SELECT json FROM app_settings WHERE id = ?`)
      .get(SETTINGS_ID) as { json: string } | undefined;

    if (!row) {
      const seeded = defaultSettings();
      this.save(seeded);
      return seeded;
    }

    try {
      const saved = JSON.parse(row.json) as Record<string, unknown>;
      const base = defaultSettings();
      const savedProviders = (saved.providers ?? {}) as Record<string, Record<string, unknown>>;
      return ensureProfiles(
        appSettingsSchema.parse({
          ...base,
          ...saved,
          providers: {
            openai: { ...base.providers.openai, ...savedProviders.openai },
            anthropic: { ...base.providers.anthropic, ...savedProviders.anthropic },
            gemini: { ...base.providers.gemini, ...savedProviders.gemini },
            ollama: { ...base.providers.ollama, ...savedProviders.ollama },
            custom: { ...base.providers.custom, ...savedProviders.custom },
          },
          profiles: Array.isArray(saved.profiles) ? saved.profiles : base.profiles,
        }),
      );
    } catch {
      return defaultSettings();
    }
  },

  save(settings: AppSettings): AppSettings {
    const parsed = ensureProfiles(appSettingsSchema.parse(settings));
    sqlite
      .prepare(
        `INSERT INTO app_settings (id, json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      )
      .run(SETTINGS_ID, JSON.stringify(parsed), Date.now());
    return parsed;
  },

  patch(body: Record<string, unknown>): AppSettings {
    return this.save(mergeSettingsPatch(this.get(), body));
  },

  publicView(): PublicAppSettings {
    return toPublicSettings(this.get());
  },
};
