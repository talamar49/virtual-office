/**
 * Gateway HTTP Client
 * 
 * Handles all communication with the OpenClaw Gateway API.
 * Features: retry with exponential backoff, timeout, circuit breaker pattern.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_000;

export interface GatewayError {
  status: number;
  message: string;
  retryable: boolean;
}

// Circuit breaker state
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 30_000;

/**
 * Check if the circuit breaker is open (too many failures)
 */
function isCircuitOpen(): boolean {
  if (consecutiveFailures < CIRCUIT_THRESHOLD) return false;
  if (Date.now() > circuitOpenUntil) {
    // Half-open: allow one attempt
    return false;
  }
  return true;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(`[Gateway] Circuit breaker OPEN — too many failures (${consecutiveFailures}). Retry in ${CIRCUIT_RESET_MS / 1000}s`);
  }
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invoke a Gateway tool with retry logic
 */
export async function invokeTool<T = unknown>(
  tool: string,
  params: Record<string, unknown> = {},
  options: { retries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const { retries = MAX_RETRIES, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  if (isCircuitOpen()) {
    throw Object.assign(new Error('Circuit breaker is open — Gateway unreachable'), {
      status: 503,
      retryable: true,
    });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
        },
        body: JSON.stringify({ tool, params }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const isRetryable = res.status >= 500 || res.status === 429;
        const error = Object.assign(
          new Error(`Gateway responded ${res.status}: ${res.statusText}`),
          { status: res.status, retryable: isRetryable }
        );

        if (!isRetryable || attempt === retries) {
          recordFailure();
          throw error;
        }

        lastError = error;
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[Gateway] Attempt ${attempt + 1} failed (${res.status}). Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }

      const data = await res.json();
      recordSuccess();
      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = new Error(`Gateway request timed out after ${timeoutMs}ms`);
      } else if (err.status) {
        // Already a structured error from above
        if (attempt === retries) throw err;
        lastError = err;
      } else {
        // Network error (ECONNREFUSED, etc.)
        lastError = err;
      }

      if (attempt < retries) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[Gateway] Attempt ${attempt + 1} failed: ${(lastError as Error).message}. Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      }
    }
  }

  recordFailure();
  throw lastError ?? new Error('Gateway request failed after all retries');
}

/**
 * Fetch all active sessions from the Gateway
 */
export async function fetchSessions(activeMinutes = 120): Promise<any[]> {
  const data = await invokeTool<any>('sessions_list', {
    activeMinutes,
    messageLimit: 1,
  });

  // Handle various response shapes
  return data?.sessions ?? data?.result?.sessions ?? [];
}

/**
 * Get gateway health status
 */
export async function checkGatewayHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await invokeTool('sessions_list', { activeMinutes: 1, messageLimit: 0 }, {
      retries: 0,
      timeoutMs: 5_000,
    });
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Get circuit breaker status (for health endpoint)
 */
export function getCircuitStatus() {
  return {
    failures: consecutiveFailures,
    isOpen: isCircuitOpen(),
    opensAt: CIRCUIT_THRESHOLD,
    resetsAt: circuitOpenUntil > Date.now() ? new Date(circuitOpenUntil).toISOString() : null,
  };
}
