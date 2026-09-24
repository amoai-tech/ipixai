# Testomat.io CLI Documentation

This document provides comprehensive information about the `check-tests` CLI commands, which synchronizes test scenarios, and interacts with Testomat.io test cases from your local project with TMS.

---

## Prerequisites

### Run check-tests via npx (always latest)

Invoke `check-tests` through `npx` so users automatically pick up the newest published version:

```bash
# First invocation in the agent session — forces resolve of latest
npx check-tests@0.21.0 <command>

# Use the same exact version for every invocation in the session
npx check-tests@0.21.0 <command>
```

Do not use a mutable `@latest` selector in automation. This skill pins `check-tests@0.21.0`; update that version only after reviewing a newer release.

---

## Environment Variables

The tool supports loading environment variables from `.env` files using dotenv.

### Testomat.io Configuration

| Variable                 | Description                                            | Required                              |
| ------------------------ | ------------------------------------------------------ | ------------------------------------- |
| `TESTOMATIO`             | API key for Testomat.io (format: tstmt_xxxxx)          | Yes (for sync operations)             |
| `TESTOMATIO_URL`         | Testomat.io server URL                                 | No (default: https://app.testomat.io) |
| `TESTOMATIO_WORKDIR`     | Working directory for relative file paths              | No                                    |
| `TESTOMATIO_PREPEND_DIR` | Directory to prepend to test paths                     | No                                    |
| `TESTOMATIO_LABELS`      | Comma-separated labels. Supports `label:value`         | No                                    |

### Configuration File

Save credentials to `.env` only after verifying `.env` is gitignored (`git check-ignore -q .env`). If it is not ignored, use an environment variable or secret store instead:

```env
TESTOMATIO=tstmt_xxxxx
TESTOMATIO_URL=https://app.testomat.io
...
```

---

## CLI Options

### Basic "check-tests" Options

| Option                | Description                                 | Default                     |
| --------------------- | ------------------------------------------- | ----------------------------|
| `-h, --help`          | Display help information                    | -                           |
| `-d, --dir <dir>`     | Test directory to scan                      | Current dir  (default: `.`) |
| `--suite-ids <ids>`   | Comma-separated suite IDs to pull (e.g. `@S12345678, @S456r4342`)  | -    |

### Testomat.io Integration Specific Project Options

| Option                        | Description                                                   | Default |
| ----------------------------- | ------------------------------------------------------------- | ------- |
| `--update-ids`                | Update test and suite with Testomat.io IDs                    | false   |
| `--keep-structure`            | Prefer structure of source code over structure in Testomat.io | false   |
| `--no-empty`                  | Remove empty suites after import                              | false   |
| `--clean-ids`                 | Remove Testomat.io IDs from test and suite                    | false   |

---

## Commands

### Pull

Retrieve the latest test scenarios from Testomat.io and save them as Markdown files locally.

```bash
npx check-tests@0.21.0 pull [options]
```

**Examples:**

```bash
# Export tests to current directory
npx check-tests@0.21.0 pull

# Export tests to manual-tests folder
npx check-tests@0.21.0 pull -d manual-tests

# Keep source structure
npx check-tests@0.21.0 pull -d manual-tests --keep-structure

# Pull specific suites only
npx check-tests@0.21.0 pull --suite-ids "@S12345678,@S87654321"
```

### Push

Send local Markdown test updates to Testomat.io. (Equivalent to `check-tests manual <files> --update-ids`.)

```bash
npx check-tests@0.21.0 push [options]
```

`--files` (alias `-f`) accepts file paths, glob patterns, or a mix; defaults to `**/*.test.md`. Paths resolve relative to `--dir`. Quote globs.

**Best practice:** when the files to push are known, list them explicitly via `--files` rather than relying on the default glob.

**Examples:**

```bash
# Default glob (**/*.test.md)
npx check-tests@0.21.0 push

# Specific files
npx check-tests@0.21.0 push -f docs/login.test.md docs/checkout.test.md

# Glob (quoted)
npx check-tests@0.21.0 push --files "manual-tests/**/*.test.md"

# Multiple globs
npx check-tests@0.21.0 push -f "smoke/**/*.test.md" "regression/**/*.test.md"

# With labels
TESTOMATIO_LABELS=smoke,updated npx check-tests@0.21.0 push
```

---

## Quick Reference

| Action          | Command                                                        |
| --------------- | -------------------------------------------------------------- |
| Pull tests      | `npx check-tests@0.21.0 pull -d <dir>`                                |
| Push files      | `npx check-tests@0.21.0 push --files <file1.test.md> <file2.test.md>` |
| Push glob       | `npx check-tests@0.21.0 push --files "<dir>/**/*.test.md"`            |
| Push directory  | `npx check-tests@0.21.0 push -d <dir>` (glob: `**/*.test.md`)         |
| With labels     | `TESTOMATIO_LABELS=smoke npx check-tests@0.21.0 push`                 |
| Keep structure  | `npx check-tests@0.21.0 pull --keep-structure`                        |