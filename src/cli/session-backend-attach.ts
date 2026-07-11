import type { PersistentBackendType } from '../core/persistent-backend.js';
import type { BackendType } from '../adapters/backend/types.js';

export function resolveSessionBackendType(
  sessionBackend: BackendType | undefined,
  botBackend: BackendType | undefined,
): BackendType | undefined {
  return sessionBackend ?? botBackend;
}

export function sessionAttachCommand(
  backend: PersistentBackendType,
  sessionName: string,
): { command: string; args: string[] } {
  if (backend === 'herdr') return { command: 'herdr', args: ['session', 'attach', sessionName] };
  if (backend === 'zellij') return { command: 'zellij', args: ['attach', sessionName] };
  return { command: 'tmux', args: ['attach-session', '-t', sessionName] };
}
