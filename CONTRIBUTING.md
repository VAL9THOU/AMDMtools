# Contributing

Thanks for contributing to Arma Modlist Diff Tool.

## Development setup

### 1) Requirements

- Node.js 22+
- npm 10+

### 2) Install dependencies

```bash
npm install
```

### 3) Run locally

```bash
npm run dev
```

## Project structure

- `src/`: React web app
- `packages/core/`: reusable parsing/diff/format/merge module
- `e2e/`: Playwright end-to-end tests
- `test-fixtures/`: fixture HTML inputs
- `docs/`: specifications and build schedules

## Validation before PR

Run all checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Pull request guidelines

- Keep PRs focused and scoped to one logical change.
- Update relevant docs when behavior changes.
- Add or update tests for new behavior.
- Do not commit secrets or environment-specific files.
- Ensure CI is green before requesting review.

## Commit message style

Use short, imperative commit subjects. Examples:

- `Add section-level merge test ids for E2E stability`
- `Fix section header overflow intercepting merge button clicks`

## Reporting bugs

When opening an issue, include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and OS
- Example modlist/preset files if possible
