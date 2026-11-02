import { afterEach, expect, it } from "vitest";

interface EnvironmentVariableDefinition {
  public?: boolean;
  schema?: {
    "~standard"?: {
      validate?: (input: unknown) => unknown;
    };
  };
}

interface ExpectedEnvironmentVariables {
  private: readonly string[];
  public: readonly string[];
  /** URL variables that also accept a same-origin path such as `/storage`. */
  paths?: readonly string[];
  /** Variables whose consumers validate the value instead of the URL schema. */
  unvalidated?: readonly string[];
  /** Variables that must be set when the server starts, but not while building. */
  requiredAtRuntime?: readonly string[];
}

const rejectedValueMarker = "rejected-value-marker";

export const testAppEnvironment = (
  variables: object,
  expected: ExpectedEnvironmentVariables,
  setBuilding: (building: boolean) => void = () => {}
): void => {
  const entries = Object.entries(variables) as [string, EnvironmentVariableDefinition][];
  const validate = (definition: EnvironmentVariableDefinition, input: string | undefined) =>
    definition.schema?.["~standard"]?.validate?.(input);
  const rejects = (result: unknown): boolean =>
    typeof result === "object" && result !== null && "issues" in result;

  afterEach(() => setBuilding(false));

  it("keeps environment variables scoped and optional at build time", () => {
    const definitions = new Map(entries);
    const expectedNames = [...expected.private, ...expected.public].sort();

    expect([...definitions.keys()].sort()).toEqual(expectedNames);

    setBuilding(true);
    const publicNames = new Set(expected.public);
    for (const [name, definition] of entries) {
      expect(definition.public === true).toBe(publicNames.has(name));
      expect(definition.schema?.["~standard"]?.validate).toBeTypeOf("function");
      expect(validate(definition, undefined)).toEqual({ value: "" });
      expect(validate(definition, "https://configured.test")).toEqual({
        value: "https://configured.test"
      });
    }
  });

  it("rejects malformed URLs without echoing the value", () => {
    const unvalidated = new Set(expected.unvalidated);
    const paths = new Set(expected.paths);

    for (const [name, definition] of entries) {
      if (unvalidated.has(name)) continue;

      for (const input of [
        `configured.test/${rejectedValueMarker}`,
        `ftp://configured.test/${rejectedValueMarker}`
      ]) {
        const result = validate(definition, input);
        expect(rejects(result), `${name} accepted ${input}`).toBe(true);
        expect(JSON.stringify(result)).not.toContain(rejectedValueMarker);
      }

      expect(rejects(validate(definition, "/storage")), `${name} path handling`).toBe(
        !paths.has(name)
      );
    }
  });

  it("requires only the declared variables when the server starts", () => {
    const required = new Set(expected.requiredAtRuntime);
    setBuilding(false);

    for (const [name, definition] of entries) {
      for (const input of [undefined, "", "  "]) {
        expect(rejects(validate(definition, input)), `${name} with ${String(input)}`).toBe(
          required.has(name)
        );
      }
    }
  });
};
