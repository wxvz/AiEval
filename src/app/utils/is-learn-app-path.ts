/** True for Learn hub and lesson/lab URLs after stripping query and hash. */
export function isLearnAppPath(url: string): boolean {
  const path = url.split(/[?#]/, 2)[0];
  return path === '/learn' || path.startsWith('/learn/');
}
