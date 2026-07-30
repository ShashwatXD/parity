import { SettingsRepository } from '../repositories/settingsRepository.js';
import type { AppSettings, PublicAppSettings } from './settingsTypes.js';

export function getSettings(): AppSettings {
  return SettingsRepository.get();
}

export function getPublicSettings(): PublicAppSettings {
  return SettingsRepository.publicView();
}

export function updateSettings(patch: Record<string, unknown>): PublicAppSettings {
  SettingsRepository.patch(patch);
  return SettingsRepository.publicView();
}

export function getSystemPrompt(): string {
  return getSettings().systemPrompt;
}

export function getCondensationPrompt(): string {
  return getSettings().condensationPrompt;
}

export function getMaxAgentSteps(): number {
  return getSettings().maxAgentSteps;
}
