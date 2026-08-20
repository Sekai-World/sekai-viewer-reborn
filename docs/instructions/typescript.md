# TypeScript Instructions

- Use the repository's strict TypeScript and ESM configuration. Do not introduce
  CommonJS `require` or `module.exports`.
- Match the surrounding folder structure and naming: use kebab-case filenames,
  PascalCase for components, classes, and type declarations, and camelCase for
  values and functions. Name code for its domain behavior.
- Do not use explicit or implicit `any`. Model uncertain input as `unknown` and
  narrow it with type guards or schema validation. Reuse shared contracts rather
  than duplicating structural types; use discriminated unions for meaningful
  states and events.
- Prefer readable, focused functions and immutable data where practical. Extend
  an existing abstraction before adding a parallel one.
- Use `async`/`await`, handle expected failure paths deliberately, and preserve
  useful context when propagating errors. Clean up timers, listeners, abort
  controllers, and other resources deterministically.
- Validate external input before use and rely on framework escaping for rendered
  content. Treat `@html` and dynamic execution as exceptional and only use them
  with trusted, sanitized input.
- Never hardcode, log, or commit secrets. Read configuration through the
  established helpers and document new configuration keys.
- Add focused tests for changed behavior. Prefer injected clocks, deterministic
  randomness, and mocks over timing-sensitive tests.
