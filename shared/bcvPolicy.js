export const BCV_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const BCV_MAX_CHANGE_RATIO = 0.2;
export const BCV_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const BCV_RATE_LIMIT_MAX_REQUESTS = 30;

export function isReasonableBCVRate(rate, previousRate) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > Number.MAX_SAFE_INTEGER) {
    return false;
  }

  if (!Number.isFinite(previousRate) || previousRate <= 0) {
    return true;
  }

  return Math.abs(rate - previousRate) / previousRate <= BCV_MAX_CHANGE_RATIO;
}

export function shouldPersistBCVRate(previousRate, nextRate, now = Date.now()) {
  if (!previousRate || Number(previousRate.value) !== nextRate) {
    return true;
  }

  const savedAt = Date.parse(previousRate.fetchedAt);
  return !Number.isFinite(savedAt) || now - savedAt >= BCV_REFRESH_INTERVAL_MS;
}

export function createInMemoryRateLimiter({
  maxRequests = BCV_RATE_LIMIT_MAX_REQUESTS,
  windowMs = BCV_RATE_LIMIT_WINDOW_MS,
} = {}) {
  const requestsByClient = new Map();
  let callsSinceCleanup = 0;

  return (clientId, now = Date.now()) => {
    const key = clientId || 'unknown';
    const activeRequests = (requestsByClient.get(key) || [])
      .filter((requestedAt) => now - requestedAt < windowMs);

    if (activeRequests.length >= maxRequests) {
      requestsByClient.set(key, activeRequests);
      return false;
    }

    activeRequests.push(now);
    requestsByClient.set(key, activeRequests);
    callsSinceCleanup += 1;

    if (callsSinceCleanup >= 100 || requestsByClient.size > 10000) {
      for (const [client, timestamps] of requestsByClient) {
        const recentRequests = timestamps.filter((requestedAt) => now - requestedAt < windowMs);
        if (recentRequests.length) requestsByClient.set(client, recentRequests);
        else requestsByClient.delete(client);
      }
      callsSinceCleanup = 0;
    }

    return true;
  };
}