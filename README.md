# GateReady

**Phase gate readiness for manufacturing suppliers, inside Jira and Confluence.**

GateReady reads the evidence scattered across Jira and Confluence and tells a quality engineer whether a project can pass its next phase gate, what is missing, and who owns it. A Rovo agent, the Gate Review Agent, runs the same checks in conversation, assigns gaps and drafts the gate review summary.

Built for Atlassian Codegeist 2026, category **Apps for Specialized Industries** (manufacturing).

> All demo data is fictional. Company names, parts and numbers are invented, and only generic APQP/PPAP terms are used.

## The problem

Automotive suppliers develop parts through phase gates (for example the five APQP phases). Before each gate review someone has to confirm by hand that every piece of evidence exists and is valid: the PFMEA is approved, the Control Plan reflects the latest design change, the MSA plan exists, no high-risk item is still open. This takes hours per gate, and what gets missed surfaces in the review meeting or in a customer audit.

A document that merely exists is not evidence. GateReady checks what a reviewer would check:

| Rule | What it verifies |
|---|---|
| Document exists | A Confluence page with a given label or title is in the project space |
| Document is approved | The page status is one of the approved statuses |
| Document is up to date | The page was edited after a reference date, such as the last design change |
| Document has required sections | Every required heading is present, and none is an empty placeholder |
| All matching work items are done | Every Jira work item matched by a JQL filter is done |
| No matching work items | A JQL filter (for example unresolved high-risk items) returns nothing |

Each requirement gets one of three verdicts: **Met**, **Not met**, or **Needs review**. Needs review is used when a rule cannot decide, for example a required section that exists but only says "TBD", or content the current user is not allowed to read. GateReady never reports "Not met" for something it could not read.

## What is in the app

- **Gate readiness dashboard** (Jira project page): readiness bar per gate, verdict and finding per requirement, links to the evidence, "Run check" and "Check all gates".
- **Gate plan settings** (Jira project settings page): add, edit, reorder and delete gates and evidence requirements, pick owners, link the Confluence space, set the last design change date. Start from the built-in APQP template or copy another project's plan.
- **Gap work items**: one Jira work item per gap, assigned to the requirement owner, with the finding and evidence links. Running it twice never creates duplicates.
- **Gate Review Agent** (Rovo agent): checks, explains, lists gaps, creates gap work items after confirmation, reads the evidence to give an advisory opinion, and drafts the gate review summary as a Confluence draft page.
- **MCP server** (`rovo:mcp`): the same six actions are exposed as tools for other agents and MCP clients.
- **Reusable skill** (`rovo:skill`): the gate review preparation procedure, packaged as `skills/gate-review-prep/SKILL.md`.
- **Demo data loader** (Jira admin page): creates two fictional projects so the whole flow can be tried on an empty site.

### Deterministic verdicts, advisory agent

Verdicts are computed by plain code, not by a language model, so the same data always gives the same answer and every verdict can be traced to a rule and a link. The agent explains results and may comment on whether a document's content looks sufficient, but that opinion is shown separately and never changes a verdict.

## Try it (for judges)

**[Install GateReady](https://developer.atlassian.com/console/install/567de6ab-b00b-4ec7-95c7-2c1073e9281e?signature=AYABeLidwtvSKR%2B%2BReVH%2BQnbiCwAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBBliUfXdZJ%2F%2B9hz1OVsc5kQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDLd5DejrdEJKxHA3zAIBEIA7JgOEnFK0caP%2FO4cko5uVuzHPsDcAPgbi%2Bm2HE7PoJJ3azN2t5D47NYIzNLhdK7gFHiNxkB0pbo9rxmQAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfqk1wpCv%2BdSTxthb3TNbwAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMzw86NyDeT26NeooHAgEQgDtgL4tI0M3Xas4nVRPNz6N%2BNy2thuNPqYLPeWOS%2FYoBsW6BXrUpywhHbg49vX5F8oXX7w8OzMW7pHeZqAAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAVX0cgjILXCrAezlcLtDkgYAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAy%2FDvaPn8Tskm%2B9smwCARCAO33RqeczbRulSEaNpsU1sRy6Xc6eBnKSBdx76HD%2F5NjmuhJfSs5uQ3YMYkguYVhCFq13xTxn7d33Fy0sAgAAAAAMAAAQAAAAAAAAAAAAAAAAADMMhhvbKpAvVMyketl1qhz%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADIp6STGr43GwnJXS0LwtyEjsgPufE9fX62GiAjqCNtCuJ5lU9%2Bo4zkQDlNHayYsnEKic5vbFXErptPDLHDfuIYY3MI%3D&product=jira&product=confluence)** (you must be an administrator of the site)

The link opens Atlassian's installation screen. Choose your site and install into **Jira**, then open the link again and install into **Confluence**. Both are needed: Jira hosts the app, and the document rules read Confluence.

[Privacy policy](PRIVACY.md)

You need a site with Jira and Confluence.

The Gate Review Agent needs Rovo chat on the site (a "Chat" or "Ask Rovo" button in the top bar). Some free developer sites do not have it. If yours does not, use a Forge demo site, which includes Rovo: run `forge site provision`, then install the app there with `forge install --demo-site`. Everything except the agent works without Rovo.

1. **Load the demo data.** In Jira, open Settings > Apps > **GateReady demo data** and select **Create demo data**. It takes about a minute and creates two projects (`BSH`, `EVB`) with matching Confluence spaces. You must be a Jira administrator.
2. **Open the dashboard.** Open the project **EV Battery Bracket**, choose **GateReady** in the project navigation (it may be under "More"), and select **Check all gates**.
3. **Compare.** Do the same in **Brake Sensor Housing**. Both projects use the same APQP template and are at the same gate, but the results differ:

   | Project | Process Design gate | Why |
   |---|---|---|
   | Brake Sensor Housing | 88% (7 of 8 met, 1 needs review) | The PFMEA has a "Recommended Actions" heading with no content |
   | EV Battery Bracket | 38% (3 of 8 met) | PFMEA not approved, Control Plan older than the last design change, MSA plan missing, open tasks, two unresolved high-risk items |

4. **Raise the gaps.** In EV Battery Bracket select **Create work items for 5 gaps** and confirm. Select it again to see that nothing is duplicated.
5. **Close a gap.** Open the EV Battery Bracket Control Plan page in Confluence, edit and publish it, then select **Run check**. "Control Plan reflects the latest design change" turns to Met.
6. **Change the rules.** Open Project settings > Apps > **GateReady settings**. Edit a requirement, add your own (any label, any JQL), save, and run the check again.
7. **Talk to the agent.** Open Rovo chat, choose **Gate Review Agent**, and try:
   - "Is EVB ready for its current gate?"
   - "What is missing in EVB, and who owns it?"
   - "Is the PFMEA in BSH good enough?"
   - "Draft the gate review summary for EVB"

To use GateReady on your own project instead, open the project's GateReady page and select **Start with the APQP template**, then link a Confluence space in the settings.

## Technical overview

- **Platform**: Atlassian Forge, one app installed in Jira (required) and Confluence. UI Kit for all screens.
- **Runs on Atlassian**: no external egress, no remote backends, no web triggers. All app data is in Forge hosted storage (KVS).
- **Permissions**: Jira and Confluence are read as the current user, so GateReady never shows evidence a user could not open themselves. Agent inputs are treated as untrusted; the project is always resolved through Jira with the user's own access.
- **Modules**: `jira:projectPage`, `jira:projectSettingsPage`, `jira:adminPage`, `rovo:agent`, `action` (6), `rovo:mcp`, `rovo:skill`.

```
manifest.yml
src/
  index.js              entry point: resolvers and action handlers
  engine/               deterministic check engine
    evaluate.js         runs every requirement of a gate
    rules/              one file per rule type
    sections.js         reads headings and section text from a page
  domain/               rule type definitions and the APQP template (no Forge imports)
  data/                 Forge storage: gate plans, results, gap links
  services/             check and gap workflows shared by the UI and the agent
  actions/              one file per Rovo agent action
  clients/              Jira and Confluence REST wrappers
  seed/                 demo scenario and loader
  frontend/             UI Kit screens (dashboard, settings, demo data)
skills/gate-review-prep/SKILL.md
test/                   unit tests for the engine and every rule type
docs/                   demo script and judging notes
```

### Agent actions

| Action | Purpose |
|---|---|
| `get-gate-status` | Stored readiness overview of every gate |
| `run-gate-check` | Fresh check of one gate against live data |
| `list-gaps` | Not met requirements with findings, evidence and owners |
| `create-gap-issues` | Creates gap work items (after user confirmation) |
| `get-evidence-content` | Excerpts of the page or the work items behind one requirement |
| `draft-gate-review-summary` | Creates the gate review summary as a Confluence draft (after user confirmation) |

### Scopes

| Scope | Used for |
|---|---|
| `read:jira-work`, `read:jira-user` | JQL rules, project lookup, permission checks |
| `write:jira-work` | Gap work items |
| `read:confluence-content.summary`, `read:page:confluence`, `read:label:confluence`, `read:space:confluence` | Finding pages by label, reading status and body |
| `write:page:confluence` | Gate review summary draft |
| `storage:app` | Gate plans and results |
| `manage:jira-configuration`, `write:confluence-space`, `write:confluence-content` | Demo data loader only (creates the demo projects, spaces, labels and statuses) |

## Development

Requires Node.js 22 or 24 and the Forge CLI.

```
npm install
npm test            # unit tests (no Forge account needed)
forge lint
forge deploy -e development
forge install -e development -p jira -s <your-site>.atlassian.net
forge install -e development -p confluence -s <your-site>.atlassian.net
```

## Limitations

- Document rules look in one Confluence space per project (a requirement can override the space).
- A space is scanned up to 1,000 pages and a JQL rule up to 500 work items.
- Approved statuses are matched by name. Confluence translates its built-in status names, so GateReady reads statuses with the app identity to get consistent names; custom status names such as "Approved" are never translated.
- English only.
