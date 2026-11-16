# Demo video script (target 4:30, hard limit 5:00)

Setup before recording: demo data loaded, both projects checked once, no gap work items in EVB yet (delete EVB-14 and later, or reload demo data on a clean site), browser zoom 110%, Rovo chat closed.

All data on screen is fictional.

| Time | Screen | What to show | What to say |
|---|---|---|---|
| 0:00 | Title card | "GateReady - know before the gate review" | "Before a phase gate review, a quality engineer at an automotive supplier checks by hand that every piece of evidence exists and is valid. It takes hours, and what is missed shows up in the meeting or in a customer audit." |
| 0:20 | Confluence space + Jira board | Flick through PFMEA page, Control Plan page, Jira board | "The evidence already lives in Confluence and Jira. Nobody has the full picture." |
| 0:35 | BSH > GateReady | Dashboard, select **Check all gates** | "GateReady is a Forge app in the Jira project. One click checks every gate against live data. Brake Sensor Housing is 88% ready for Process Design." |
| 0:55 | BSH detail table | Hover the Needs review row, open the PFMEA link | "It does not just check that a document exists. The PFMEA is approved and has every required section, but Recommended Actions only says TBD, so GateReady asks a person to look." |
| 1:15 | EVB > GateReady | Run check, scroll the table | "Same template, same gate, different project: 38%. The PFMEA is still in progress. The Control Plan is approved but older than the last design change. Two high-risk items are open." |
| 1:45 | EVB | **Create work items for 5 gaps**, confirm, show result, click one issue | "Each gap becomes a Jira work item assigned to the evidence owner, with the finding and links. Running it again creates no duplicates." |
| 2:10 | Confluence | Edit and publish the EVB Control Plan; back to GateReady, **Run check** | "The owner updates the Control Plan. Check again: that requirement is now met." |
| 2:30 | EVB project settings > GateReady settings | Edit a requirement, show rule types, add a requirement with a custom label, save | "Nothing is hard-coded. Gates, rules, owners and the linked space are configured per project. Start from the APQP template or build your own." |
| 2:55 | Rovo chat, Gate Review Agent | Ask "Is EVB ready for its current gate?" | "The Gate Review Agent runs the same deterministic check in conversation and explains each finding." |
| 3:20 | Rovo chat | Ask "Is the PFMEA in BSH good enough?" | "The agent reads the document and gives an opinion, clearly marked as advisory. It never overrides a verdict." |
| 3:45 | Rovo chat | Ask "Draft the gate review summary for EVB", confirm, open the draft | "Before writing anything it shows what it will create and asks. Then the review summary is waiting as a Confluence draft." |
| 4:10 | Slide or code | manifest: `rovo:mcp`, `rovo:skill`; "Runs on Atlassian" | "The same actions are exposed as MCP tools and as a reusable skill, so other agents can prepare gate reviews too. No data leaves Atlassian." |
| 4:25 | Title card | Who it is for, link | "GateReady: for quality engineers and project managers who need to know before the gate review, not during it." |

## Notes

- If Rovo is slow, record the three agent prompts separately and cut.
- Keep the readiness numbers visible for at least two seconds whenever they change.
- Step 2:10 depends on a real edit: add one sentence to the Control Plan and publish.
