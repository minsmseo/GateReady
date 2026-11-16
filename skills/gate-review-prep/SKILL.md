---
name: gate-review-prep
description: Prepare a manufacturing phase gate review (for example an APQP gate) for a Jira project. Checks whether the evidence the gate requires exists, is approved and is up to date in Jira and Confluence, lists gaps with owners, raises gap work items after confirmation, and drafts the gate review summary page. Use when someone asks whether a project is ready for a gate, what evidence is missing, or to prepare a gate review meeting.
allowed-tools: get-gate-status run-gate-check list-gaps create-gap-issues get-evidence-content draft-gate-review-summary
compatibility: Requires the GateReady Forge app installed in Jira and Confluence, and a gate plan configured for the project.
---

# Gate review preparation

Use this procedure to prepare a phase gate review for one Jira project. It works for any gate plan set up in GateReady, including the built-in APQP phases.

## Ground rules

- Verdicts (Met, Not met, Needs review) come from deterministic rules in the tools. Report them unchanged. Never invent or override a verdict.
- Your own reading of a document is advisory. Keep it under a separate heading and say that a reviewer should confirm it.
- `create-gap-issues` and `draft-gate-review-summary` write to Jira and Confluence. Show the user what will be created and get an explicit yes before calling them.
- Every tool takes an optional `projectKey` (Jira project key) and, except `get-gate-status`, an optional `gate` (name or number). Omit `gate` to use the project's current gate.

## Procedure

1. **Orient.** Call `get-gate-status` to see the gates, the current gate and when each was last checked. If the tool reports that the project has no gate plan, stop and tell the user a project administrator must set one up in Project settings > GateReady settings.
2. **Check.** Call `run-gate-check` for the gate under review. This reads live data, so run it again whenever documents or work items may have changed.
3. **Report readiness.** Lead with the readiness percentage and the counts. List Not met items first, then Needs review items, each with its finding and evidence link. Mention Met items briefly.
4. **Look closer where rules cannot judge.** For each Needs review item, and for key documents such as the FMEA or Control Plan, call `get-evidence-content` and read the excerpt. Note placeholders ("TBD"), sections with little substance, or controls that do not address the listed causes. Present these as "Worth a reviewer's look".
5. **Assign gaps.** Call `list-gaps`. Show each gap with its owner and any existing work item. Ask whether to create work items. On a clear yes, call `create-gap-issues` and report the created keys and what was skipped as already raised.
6. **Draft the summary.** Tell the user a draft page will be created in the project's Confluence space for the gate. On a clear yes, call `draft-gate-review-summary`, passing your advisory observations from step 4 as `reviewerNotes`. Share the link and remind the user that the draft is unpublished until they publish it.

## Handling problems

- A tool result with an `error` field is a message for the user. Relay it in plain words with the next step it suggests.
- "Needs review" because of missing permission means the current user cannot read that Jira or Confluence content. Say so; do not treat it as missing evidence.
- If a requirement looks wrongly configured (for example an invalid JQL filter), tell the user to fix it in GateReady settings.

## Comparing projects

To compare projects, run steps 1 to 3 for each project key and present the results side by side. The same gate plan gives different results for different projects because each requirement is evaluated against that project's own work items and linked Confluence space.
