import { describe, expect, it } from 'vitest';
import { resolveSessionBackendType, sessionAttachCommand } from '../src/cli/session-backend-attach.js';

describe('sessionAttachCommand', () => {
  it('attaches herdr sessions through herdr instead of tmux', () => {
    expect(sessionAttachCommand('herdr', 'bmx-12345678')).toEqual({
      command: 'herdr',
      args: ['session', 'attach', 'bmx-12345678'],
    });
  });

  it.each([
    ['tmux', 'tmux', ['attach-session', '-t', 'bmx-12345678']],
    ['zellij', 'zellij', ['attach', 'bmx-12345678']],
  ] as const)('keeps the %s native attach command', (backend, command, args) => {
    expect(sessionAttachCommand(backend, 'bmx-12345678')).toEqual({ command, args });
  });
});

describe('resolveSessionBackendType', () => {
  it('prefers the backend stamped on the session', () => {
    expect(resolveSessionBackendType('tmux', 'herdr')).toBe('tmux');
  });

  it('uses the explicit bot backend for legacy sessions', () => {
    expect(resolveSessionBackendType(undefined, 'herdr')).toBe('herdr');
  });
});
