# Practicer

[![CI](https://github.com/commjoen/Practicer/actions/workflows/ci.yml/badge.svg)](https://github.com/commjoen/Practicer/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/commjoen/Practicer/actions/workflows/pages.yml/badge.svg)](https://github.com/commjoen/Practicer/actions/workflows/pages.yml)

Practicer is a cheerful little web app for GitHub Pages that helps kids learn
vocabulary in another language. Pick one or more lessons, read the meaning of a
word, type the matching spelling yourself, and finish with a simple score.

GitHub Pages URL: https://commjoen.github.io/Practicer/

## What the first version does

- Loads lesson content from a JSON file
- Supports multiple language packs
- Remembers the last practiced language pack
- Lets learners select one or more lessons before starting
- Lets learners practice in both language directions
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

The sample lessons live in `/src/data/lessons.json`. Each language pack has:

- an `id`
- a `name`
- `sourceLanguage` and `targetLanguage`
- a `lessons` array

Each lesson has:
- an `id`
- a `name`
- a `description`
- a `words` array with `source` and `target` pairs (either side can be a string or an array for accepted alternatives)

Lesson `id` values are selected within the active language pack, so keep them unique per pack.

## URL shortcuts

- `?pack=dutch-english&direction=source-to-target&lessons=dutch-lesson-1&practice=1` opens a practice round directly.
- `?pack=dutch-english&direction=source-to-target&lesson=dutch-lesson-1&page=2` opens a lesson word preview on a specific page (`lessons=...` may also appear when copied from the app).

## Automation included

- **CI**: installs dependencies on Node 26, then lints, tests, and builds
- **GitHub Pages**: builds and deploys the site
- **Release Please**: manages versioning and GitHub releases
- **Renovate**: keeps dependencies and GitHub Actions up to date
