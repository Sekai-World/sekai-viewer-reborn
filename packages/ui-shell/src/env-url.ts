export interface EnvUrlOptions {
  /** Also accept a same-origin path such as `/storage`. */
  readonly allowPath?: boolean;
  /** Reject an unset or blank value. */
  readonly required?: boolean;
}

const isHttpUrl = (value: string): boolean => {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
};

const isRootRelativePath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//");

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
