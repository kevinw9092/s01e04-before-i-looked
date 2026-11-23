---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries what "What every issue carries" below says. Ask the human only about
   anything beyond that (extra fields, labels, wording).
5. Create the plan's label once (`gh label create "plan:<plan>"`), then each issue in dependency
   order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md> --label "plan:<plan>"
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Agreed with the human on the morning-digest plan (2026-11-23). The reviewer sorts on the first
line and the label, so keep both exactly.

- **Label:** `plan:<plan>`, the `plan:` value from `plan.md`'s frontmatter (e.g. `plan:morning-digest`).
- **Body**, in this order:

  ```md
  Source: plan.md § <n>

  ## Scope
  <what the section asks for, in the plan's words; the rules from AGENTS.md / ADRs that apply>

  ## Done when
  <the plan's done line, checkable>

  ## Blocked by
  <#n, or —; say when only part of #n is needed (e.g. "#1 (types.ts only)")>

  ## Worker model
  <the model planned for it: strongest for logic, cheaper for views and tests (AGENTS.md)>
  ```

- **Waits on someone outside** (a reviewer, a human, a host): say so under Blocked by. Such an
  issue stays open until they have answered, even when its done line reads as met once you have
  sent something.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
