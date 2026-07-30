import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectStuck, stepFromToolCall } from '../agent/stuckDetector.js';

describe('stuckDetector', () => {
  it('detects repeating action-observation', () => {
    const steps = Array.from({ length: 4 }, () =>
      stepFromToolCall({
        toolName: 'terminal',
        args: { command: 'ls' },
        result: 'ok',
      }),
    );
    const v = detectStuck(steps);
    assert.equal(v.stuck, true);
    if (v.stuck) assert.equal(v.reason, 'repeating_action_observation');
  });

  it('detects repeating errors', () => {
    const steps = Array.from({ length: 4 }, () =>
      stepFromToolCall({
        toolName: 'file_editor',
        args: { command: 'view', path: 'missing.ts' },
        result: 'ENOENT',
        isError: true,
      }),
    );
    const v = detectStuck(steps);
    assert.equal(v.stuck, true);
    if (v.stuck) assert.equal(v.reason, 'repeating_action_error');
  });

  it('allows progressing different calls', () => {
    const steps = [
      stepFromToolCall({ toolName: 'glob', args: { pattern: '*.ts' }, result: 'a' }),
      stepFromToolCall({ toolName: 'grep', args: { pattern: 'foo' }, result: 'b' }),
      stepFromToolCall({ toolName: 'terminal', args: { command: 'pwd' }, result: 'c' }),
    ];
    assert.equal(detectStuck(steps).stuck, false);
  });
});
