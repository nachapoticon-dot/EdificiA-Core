#!/usr/bin/env node

console.log(
  [
    "[migrate] Legacy raw SQL migrations are archived in docs/archive/db-migrations-legacy.",
    "[migrate] The active migration path is migrations/ via InsForge CLI.",
    "[migrate] Run: npm run migrate",
  ].join("\n"),
);
