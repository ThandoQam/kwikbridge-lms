# KwikBridge LMS — CI/CD Pipeline (FI-6)

## Overview

GitHub Actions CI/CD pipeline with 5 quality gates that run on every push to
main and every pull request. Vercel handles deployment automatically.

## Pipeline Architecture

```
Push to main / PR opened
  ↓
┌─────────────────────────────┐
│  JOB 1: Quality Gates       │
│  ├── npm ci                  │
│  ├── tsc --noEmit            │  ← TypeScript: zero errors
│  ├── eslint src/             │  ← Lint: ≤50 warnings
│  └── check.py                │  ← Monolith integrity
└──────────┬──────────────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
┌────────┐  ┌──────────┐  ┌──────────────┐
│ Build  │  │  Tests   │  │   Security   │
│ vite   │  │ 3 suites │  │  npm audit   │
│ build  │  │ ~340     │  │  secret scan │
│        │  │ tests    │  │              │
└───┬────┘  └────┬─────┘  └──────────────┘
    ↓            ↓
┌─────────────────────────────┐
│  Deploy Status               │
│  Vercel auto-deploys main    │
└─────────────────────────────┘
```

## Workflows

### `ci.yml` — Main Pipeline (push + PR)

| Job | Steps | Blocks Deploy |
|-----|-------|--------------|
| Quality | tsc + eslint + check.py | Yes |
| Build | vite build + artifact upload | Yes |
| Test | test_suite + smoke + data_validation | Yes |
| Security | npm audit + secret scan | No (advisory) |
| Deploy Status | Confirmation message | No |

### `pr.yml` — Pull Request Checks

Lighter pipeline for PRs: typecheck → build → integrity → core tests.
Writes summary to PR as a GitHub Step Summary.

## Local Commands

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/ (≤50 warnings)
npm run lint:fix     # eslint --fix
npm run check        # python3 check.py (monolith integrity)
npm run test         # core test suites
npm run test:all     # all 11 test suites
npm run build        # vite production build
npm run ci           # full local CI: typecheck + lint + check + build
```

## Pre-Commit Hook

Installed at `.git/hooks/pre-commit` (source: `.githooks/pre-commit`).

Runs before every commit:
1. Monolith integrity check (blocks on failure)
2. TypeScript check (blocks on failure)
3. ESLint (advisory — doesn't block)

To install on a fresh clone:
```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## ESLint Configuration

Flat config format (`eslint.config.js`) for ESLint v9+.

Key rules:
- `no-eval`, `no-implied-eval`, `no-new-func` — **error** (security)
- `no-debugger` — **error** (no debug in production)
- `prefer-const`, `no-var` — **warn/error** (code quality)
- `@typescript-eslint/no-explicit-any` — **off** (gradual typing)
- `@typescript-eslint/no-unused-vars` — **warn** (expected in extracted features)

Warning threshold: 50 (feature files have expected unused references from monolith extraction).

## Branch Protection (Recommended)

Configure in GitHub → Settings → Branches → main:

1. ✅ Require pull request before merging
2. ✅ Require status checks: `Quality Gates`, `Build`, `Test Suite`
3. ✅ Require branches to be up to date
4. ✅ Do not allow bypassing settings
