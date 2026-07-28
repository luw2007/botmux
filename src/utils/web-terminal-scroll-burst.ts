export interface WebTerminalScrollBurst {
  end(): void;
  forward(px: number, coordinate: string): void;
}

/** Browser-safe source; this is also the implementation tested below. */
export const WEB_TERMINAL_SCROLL_BURST_SCRIPT = `
function createWebTerminalScrollBurst(send, step, maxTicks, idleMs) {
  step = step === undefined ? 33 : step;
  maxTicks = maxTicks === undefined ? 6 : maxTicks;
  idleMs = idleMs === undefined ? 250 : idleMs;
  var accumulated = 0;
  var ticks = 0;
  var direction = 0;
  var timer;
  function end() {
    clearTimeout(timer);
    timer = undefined;
    accumulated = 0;
    ticks = 0;
    direction = 0;
  }
  return {
    end: end,
    forward: function(px, coordinate) {
      if (!px) return;
      var nextDirection = px < 0 ? -1 : 1;
      if (direction && nextDirection !== direction) {
        accumulated = 0;
        ticks = 0;
      }
      direction = nextDirection;
      clearTimeout(timer);
      timer = setTimeout(end, idleMs);
      if (ticks >= maxTicks) return;
      accumulated += px;
      var data = '';
      while (Math.abs(accumulated) >= step && ticks < maxTicks) {
        var up = accumulated < 0;
        data += '\\x1b[<' + (up ? 64 : 65) + ';' + coordinate + 'M';
        accumulated += up ? step : -step;
        ticks++;
      }
      if (ticks >= maxTicks) accumulated = 0;
      if (data) send(data);
    }
  };
}
`;

export function createWebTerminalScrollBurst(
  send: (data: string) => void,
  step?: number,
  maxTicks?: number,
  idleMs?: number,
): WebTerminalScrollBurst {
  return new Function(
    'send',
    'step',
    'maxTicks',
    'idleMs',
    `${WEB_TERMINAL_SCROLL_BURST_SCRIPT}; return createWebTerminalScrollBurst(send, step, maxTicks, idleMs);`,
  )(send, step, maxTicks, idleMs) as WebTerminalScrollBurst;
}
