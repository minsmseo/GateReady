# Judging notes

How GateReady answers each Codegeist 2026 judging criterion, with where to see it.

## Technological Implementation (20%)

*Does the app feel like a genuine, working, non-trivial implementation, not a shallow wrapper or a single hardcoded demo path?*

- **No hardcoded path.** Gates, requirements, rule parameters, owners, the linked Confluence space and reference dates are data, edited per project in `src/frontend/settings.jsx` and stored in Forge storage. The engine (`src/engine/evaluate.js`) knows rule types, not APQP.
- **Same template, different results.** The two demo projects share one template and one gate and get 88% and 38%, because every rule is evaluated against that project's own work items and space.
- **Six rule types over two products**, each in its own file under `src/engine/rules/`, with 30 unit tests (`npm test`).
- **Live data.** Document lookup uses Confluence content lists rather than the search index, so an edit is visible to the next check immediately.
- **Honest failure handling.** Permission errors, invalid JQL and incomplete configuration become "Needs review" with a specific message. They are never reported as missing evidence.
- **Security.** REST calls run as the current user. Agent inputs are untrusted; the project is resolved through Jira with the user's access. Plan edits require project administration rights, checked server-side.
- **Idempotent writes.** Gap work items are tracked per requirement; re-running skips gaps with an open item and re-raises closed ones that are still gaps.
- **Rovo beyond chat.** One set of six actions serves the agent, an MCP server (`rovo:mcp`) and a reusable skill (`rovo:skill`).

## Design (20%)

*Does the project deliver a complete, coherent product experience?*

- **Full path from install to result**: demo data loader > dashboard > gap work items > settings > agent, each reachable from where a user already is in Jira.
- **The dashboard answers the question first**: a one-line verdict for the gate, then what changed since the last check, then the detail, then the check history. Recording a gate as passed moves the project to its next gate without a trip to settings.
- **Every state is designed**: no plan yet (with a one-click start), gate never checked, gate with no requirements, plan changed since the last check, no linked space, view-only for non-administrators, loading and error states with a retry.
- **Writes are confirmed.** The dashboard lists the exact work items before creating them; the agent is instructed to do the same.
- **Language of the user.** "Gate", "evidence requirement", "owner", "last design change", not "rule engine" or "entity".

## Potential Impact (20%)

*Does the project make a credible, specific case for solving a real problem for a real audience?*

- **Audience**: quality engineers and project managers at automotive part suppliers running APQP-style phase gates.
- **Problem**: hours of manual evidence checking before each gate, and gaps discovered in the review or in a customer audit.
- **Addressed in the demo**: a readiness answer in seconds, the specific gaps with owners, and a prepared review summary.
- **Audit trail**: each gate keeps when it was checked, by whom and how ready it was, and the readiness at the moment it was passed. This is the record a customer or certification auditor asks for.
- **Adoption cost is low**: it uses the labels, page statuses and JQL teams already have. No new data entry and no migration.
- **Transferable**: the gate plan is configurable, so the same app fits other gated processes in regulated manufacturing.

## Innovation / Idea (20%)

*How creative and novel is the concept?*

- **Validity, not existence.** Checklist apps record that a document was ticked off. GateReady verifies approval status, freshness against the last design change, and required sections with content.
- **Three verdicts.** "Needs review" separates what a rule can decide from what needs a person, for example a heading whose content is "TBD".
- **Deterministic core, advisory agent.** The agent explains and gives opinions on content sufficiency, but verdicts stay reproducible and auditable. This matters in a quality context where an unexplained AI judgement is not acceptable evidence.

## Presentation (20%)

- `docs/demo-script.md` is a timed script that shows the full flow in under five minutes.
- The demo scenario is code (`src/seed/`), reproducible on any site with one button.

## Bonus prizes

| Prize | Evidence |
|---|---|
| MCP | `rovo:mcp` module `gateready-mcp` in `manifest.yml` exposing all six actions |
| Reusable skill | `rovo:skill` module `gate-review-prep`, `skills/gate-review-prep/SKILL.md`, referenced by the agent |
| Runs on Atlassian | No egress, no remotes, Forge hosted storage only; the CLI reports the deployed version as eligible |
| Teamwork Graph | Not used (early access; not required by any core feature) |
