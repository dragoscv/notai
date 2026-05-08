// Public surface for the AI subsystem. Import from here, not the
// individual provider files, so call sites stay decoupled from the
// transport details.
export * from './types';
export {
  getChatProvider,
  getEmbeddingProvider,
  getTranscribeProvider,
} from './dispatch';
export {
  listUserSecrets,
  getDecryptedSecret,
  upsertUserSecret,
  deleteUserSecret,
  getUserAiPrefs,
  setUserAiPref,
  type AiProvider,
  type AiFeature,
  type AiPrefs,
} from './secrets';
export { OPENAI_MODELS, validateOpenAiKey } from './openai-provider';
export {
  startCopilotDeviceFlow,
  pollCopilotDeviceFlow,
  listCopilotModels,
  COPILOT_CLIENT_ID,
  type DeviceFlowStart,
  type DevicePollResult,
} from './copilot-provider';
export { maskKey } from './crypto';
