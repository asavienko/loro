/** F-08 / plan 72. An explicit debug build flag, never a supported learning language. */
export function pseudoLocaleEnabled(isDevelopment: boolean, flag: unknown): boolean {
  return isDevelopment && flag === '1'
}
