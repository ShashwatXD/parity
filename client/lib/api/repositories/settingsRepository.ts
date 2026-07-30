import { API_ROUTES } from '../../constants';
import type { AppSettings, SettingsUpdate } from '../../models';
import { apiGet, apiSend } from '../client';

export const settingsRepository = {
  get: () => apiGet<AppSettings>(API_ROUTES.settings),
  update: (body: SettingsUpdate) =>
    apiSend<AppSettings>(API_ROUTES.settings, { method: 'PUT', body }),
};
