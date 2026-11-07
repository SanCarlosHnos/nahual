// Índice de servicios del agente
// Re-exporta todos los servicios para facilitar las importaciones

export { ConversationManager } from './conversation-manager';
export { ContextPruner, CONFIG_PODADOR_DEFAULT, type ContextPrunerConfig } from './context-pruner';
export { LoopDetector, CONFIG_LOOP_DEFAULT, type LoopDetectorConfig } from './loop-detector';
export { ResponseValidator, type ValidationResult } from './response-validator';
