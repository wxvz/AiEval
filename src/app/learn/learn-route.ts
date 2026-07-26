/** Split a Learn CTA string like `/evaluations/new?from=learn` for Angular RouterLink. */

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function pathFromLearnRoute(route: string): string {
  return route.split(/[?#]/, 2)[0] || '/';
}

export function queryParamsFromLearnRoute(route: string): Record<string, string> {
  const query = route.split('?', 2)[1]?.split('#', 1)[0];
  if (!query) {
    return {};
  }
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    const key = decodeUriComponentSafe(rawKey);
    if (key) {
      params[key] = decodeUriComponentSafe(rawValue);
    }
  }
  return params;
}
