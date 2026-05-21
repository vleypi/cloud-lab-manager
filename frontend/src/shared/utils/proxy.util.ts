

export function matchesAny(pathname: string, prefixes: ReadonlyArray<string>): boolean {
  return prefixes.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`),
  );
}
