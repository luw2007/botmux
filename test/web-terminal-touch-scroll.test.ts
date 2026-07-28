import { describe, expect, it, vi } from 'vitest';
import { createWebTerminalScrollBurst } from '../src/utils/web-terminal-scroll-burst.js';

describe('web terminal touch scrolling', () => {
  it('caps one continuous high-resolution gesture at six remote ticks', () => {
    const send = vi.fn();
    const burst = createWebTerminalScrollBurst(send);

    burst.forward(-33 * 20, '10;5');

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].match(/\x1b\[<64;10;5M/g)).toHaveLength(6);
  });

  it('resets the limit after a gesture ends', () => {
    const send = vi.fn();
    const burst = createWebTerminalScrollBurst(send);

    burst.forward(33 * 6, '10;5');
    burst.end();
    burst.forward(33, '10;5');

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe('\x1b[<65;10;5M');
  });

  it('starts a new burst when direction reverses', () => {
    const send = vi.fn();
    const burst = createWebTerminalScrollBurst(send);

    burst.forward(-33 * 6, '10;5');
    burst.forward(33, '10;5');

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe('\x1b[<65;10;5M');
  });
});
