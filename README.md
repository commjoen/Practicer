# Practicer

Practicer is a cheerful little web app for GitHub Pages that helps kids learn
vocabulary in another language. Pick one or more lessons, read the meaning of a
word, type the matching spelling yourself, and finish with a simple score.

## What the first version does

- Loads lesson content from a JSON file
- Lets learners select one or more lessons before starting
- Shows word meanings and asks learners to spell the target-language word
- Gives instant feedback after every answer
- Shows a final score at the end of a practice round

## Development plan

1. Keep lesson content in JSON so new lessons are easy to add.
2. Focus the first release on lesson selection, spelling practice, and scoring.
3. Protect the repository with linting, tests, automated releases, Renovate, and GitHub Pages deployment.
4. Expand later with richer lesson packs, saved progress, and audio prompts.

## Tech stack

- Vite for the static site build
- Plain JavaScript modules for app logic
- ESLint for linting
- Node’s built-in test runner for focused unit tests
- GitHub Actions for CI, releases, Renovate, and GitHub Pages publishing

## Getting started

GitHub Actions are configured to run on Node 26. For local development, use a
modern Node release supported by the toolchain (Node 20+ works with the current
dependencies).

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Lesson data

The sample lessons live in `/src/data/lessons.json`. Each lesson has:

- an `id`
- a `name`
- a `description`
- a `words` array with `prompt` and `answer` pairs

## Automation included

- **CI**: installs dependencies on Node 26, then lints, tests, and builds
- **GitHub Pages**: builds and deploys the site
- **Release Please**: manages versioning and GitHub releases
- **Renovate**: keeps dependencies and GitHub Actions up to date
