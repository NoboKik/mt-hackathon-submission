// Zod schemas, shared types and the scoring function land here (schema-v1).
// Consumers import source directly; apps/web lists this package in `transpilePackages`.
// Keep relative imports extensionless (`./schema`, not `./schema.js`) — Next can't resolve .js → .ts here.

export const SHARED_PACKAGE = '@p400/shared'
