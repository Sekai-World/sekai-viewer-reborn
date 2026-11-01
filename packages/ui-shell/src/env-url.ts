export interface EnvUrlOptions {
  /** Also accept a same-origin path such as `/storage`. */
  readonly allowPath?: boolean;
  /** Reject an unset or blank value. */
  readonly required?: boolean;
}

// `https:cdn.example.com` parses, but a browser resolves it as a path against a same-scheme base.
const isHttpUrl = (value: string): boolean => {
  if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
};

// `//host` and `/\host` both resolve to another origin in browsers.
const isRootRelativePath = (value: string): boolean => /^\/(?![/\\])/.test(value);

/**
 * Creates a `defineEnvVars` validator for a URL-valued environment variable.
 * An unset or blank value stays optional (`""`) unless `required`; a set value
 * must be an absolute http(s) URL, or a root-relative path with `allowPath`.
 * Valid input is returned unchanged so existing consumers keep normalizing it.
 * Error messages never include the value, which may carry credentials.
 */
export const envUrl =
  ({ allowPath = false, required = false }: EnvUrlOptions = {}) =>
  (input: string | undefined): string => {
    if (input === undefined || input.trim().length === 0) {
      if (required) throw new Error("Value is required.");
      return input ?? "";
    }

    const value = input.trim();
    if (isHttpUrl(value) || (allowPath && isRootRelativePath(value))) return input;

    throw new Error(
      allowPath
        ? "Value must be an absolute http(s) URL or a path starting with /."
        : "Value must be an absolute http(s) URL."
    );
  };
