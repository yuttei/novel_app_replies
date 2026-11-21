#!/usr/bin/env bash
set -euo pipefail

npm run typecheck
npm run test:unit
npx playwright test
git diff --check
