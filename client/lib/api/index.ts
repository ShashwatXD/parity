export { ApiError, apiGet, apiSend, apiStream } from './client';
export {
  approvalRepository,
  chatRepository,
  healthRepository,
  mcpRepository,
  observabilityRepository,
  sessionRepository,
  settingsRepository,
  studioRepository,
  workflowRepository,
  workspaceRepository,
} from './repositories';

/** Legacy aliases — prefer *Repository names */
export { sessionRepository as SessionApi } from './repositories/sessionRepository';
export { mcpRepository as McpApi } from './repositories/mcpRepository';
export { chatRepository as ChatApi } from './repositories/chatRepository';
export { workflowRepository as WorkflowApi } from './repositories/workflowRepository';
export { approvalRepository as ApprovalApi } from './repositories/approvalRepository';
export { observabilityRepository as ObservabilityApi } from './repositories/observabilityRepository';
export { studioRepository as StudioApi } from './repositories/studioRepository';
export { settingsRepository as SettingsApi } from './repositories/settingsRepository';
