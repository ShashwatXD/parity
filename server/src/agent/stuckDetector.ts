export type StuckStep = {
  toolName: string;
  argsKey: string;
  resultKey: string;
  isError: boolean;
};

export type StuckVerdict =
  | { stuck: false }
  | {
      stuck: true;
      reason:
        | 'repeating_action_observation'
        | 'repeating_action_error'
        | 'alternating_pattern';
      message: string;
    };

/** OpenHands-style defaults: 4 / 4 / 6 */
const THRESHOLDS = {
  actionObservation: 4,
  actionError: 4,
  alternating: 6,
};

function fingerprint(value: unknown): string {
  try {
    return JSON.stringify(value ?? null).slice(0, 800);
  } catch {
    return String(value).slice(0, 800);
  }
}

export function stepFromToolCall(input: {
  toolName: string;
  args: unknown;
  result: unknown;
  isError?: boolean;
}): StuckStep {
  return {
    toolName: input.toolName,
    argsKey: fingerprint(input.args),
    resultKey: fingerprint(input.result),
    isError: Boolean(input.isError),
  };
}

export function detectStuck(steps: StuckStep[]): StuckVerdict {
  if (steps.length < Math.min(THRESHOLDS.actionObservation, THRESHOLDS.actionError)) {
    return { stuck: false };
  }

  const recent = steps.slice(-Math.max(THRESHOLDS.alternating, THRESHOLDS.actionObservation));

  // Same tool + args with errors N times (check before identical observation — errors are identical too)
  if (recent.length >= THRESHOLDS.actionError) {
    const window = recent.slice(-THRESHOLDS.actionError);
    const first = window[0]!;
    if (
      window.every(
        (s) => s.toolName === first.toolName && s.argsKey === first.argsKey && s.isError,
      )
    ) {
      return {
        stuck: true,
        reason: 'repeating_action_error',
        message:
          'Stuck detected: the same failing tool call repeated. Do not retry identically — fix inputs, inspect errors, or switch strategy.',
      };
    }
  }

  // Same tool + args + result repeated N times
  if (recent.length >= THRESHOLDS.actionObservation) {
    const window = recent.slice(-THRESHOLDS.actionObservation);
    const first = window[0]!;
    if (
      window.every(
        (s) =>
          s.toolName === first.toolName &&
          s.argsKey === first.argsKey &&
          s.resultKey === first.resultKey,
      )
    ) {
      return {
        stuck: true,
        reason: 'repeating_action_observation',
        message:
          'Stuck detected: the same tool call and result repeated. Stop looping. Change approach, read different files, or ask the user.',
      };
    }
  }

  // Alternating A/B pattern (A,B,A,B,A,B)
  if (recent.length >= THRESHOLDS.alternating) {
    const window = recent.slice(-THRESHOLDS.alternating);
    const alt =
      window.every((s, i) => {
        if (i < 2) return true;
        const peer = window[i - 2]!;
        return s.toolName === peer.toolName && s.argsKey === peer.argsKey && s.resultKey === peer.resultKey;
      }) &&
      !(
        window[0]!.toolName === window[1]!.toolName &&
        window[0]!.argsKey === window[1]!.argsKey
      );
    if (alt) {
      return {
        stuck: true,
        reason: 'alternating_pattern',
        message:
          'Stuck detected: alternating tool loop. Break the cycle — synthesize findings and take a new action or finish.',
      };
    }
  }

  return { stuck: false };
}
