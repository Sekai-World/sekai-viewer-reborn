import { expect, it } from "vitest";

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
}

export const testAppEnvironment = (
  variables: object,
  expected: ExpectedEnvironmentVariables
): void => {
  it("keeps environment variables scoped and optional at build time", () => {
    const entries = Object.entries(variables) as [string, EnvironmentVariableDefinition][];
    const definitions = new Map(entries);
    const expectedNames = [...expected.private, ...expected.public].sort();

    expect([...definitions.keys()].sort()).toEqual(expectedNames);

    const publicNames = new Set(expected.public);
    for (const [name, definition] of entries) {
      expect(definition.public === true).toBe(publicNames.has(name));

      const schema = definition.schema?.["~standard"];
      expect(schema?.validate).toBeTypeOf("function");
      expect(schema?.validate?.(undefined)).toEqual({ value: "" });
      expect(schema?.validate?.("https://configured.test")).toEqual({
        value: "https://configured.test"
      });
    }
  });
};
