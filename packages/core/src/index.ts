// Framework-free business logic (rotation rules, validation, crypto helpers)
// lives in this package — see docs/ARCHITECTURE.md#portability-discipline.
// Real logic arrives incrementally with the roadmap milestones in
// docs/ROADMAP.md (rotation engine, group key-exchange, etc).

export const CORE_PACKAGE_NAME = "@memaday/core";

export * from "./identity.js";
export * from "./group-key.js";
export * from "./invite-code.js";
export * from "./photo.js";
export * from "./rotation.js";
