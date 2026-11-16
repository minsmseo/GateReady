import api from '@forge/api';

/**
 * Error thrown when an Atlassian REST call returns a non-2xx status.
 * Carries the HTTP status so callers can tell "no permission" (401/403)
 * and "not found" (404) apart from real failures.
 */
export class ApiError extends Error {
  constructor(product, method, path, status, body) {
    super(`${product} ${method} ${path} failed with ${status}`);
    this.name = 'ApiError';
    this.product = product;
    this.status = status;
    this.body = body;
  }

  get isPermission() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

/**
 * Picks who the request runs as.
 * - "user": the person looking at the page or talking to the agent. Their
 *   own Jira/Confluence permissions apply, so GateReady never shows evidence
 *   a user could not open themselves.
 * - "app": the app's own identity. Only used where there is no user
 *   (diagnostics, scheduled work).
 */
const requester = (as) => (as === 'app' ? api.asApp() : api.asUser());

/**
 * Sends a request and returns parsed JSON (or null for empty bodies).
 * `route` must be built with the `route` template tag from @forge/api so
 * path parameters are escaped.
 */
export const send = async (product, as, routeValue, { method = 'GET', body } = {}) => {
  const client = requester(as);
  const call = product === 'jira' ? client.requestJira : client.requestConfluence;
  const options = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await call.call(client, routeValue, options);
  const text = await response.text();
  if (!response.ok) {
    // Keep the body short: it is only for logs and error messages.
    throw new ApiError(product, method, String(routeValue.value || ''), response.status, text.slice(0, 500));
  }
  return text ? JSON.parse(text) : null;
};
