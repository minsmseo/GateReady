# Demo video script

Target length 4:40 (hard limit 5:00). Narration is about 590 words, which fits at a calm 130 to 140 words per minute.

Everything on screen is fictional demo data.

## Before recording

On the demo site (the one with Rovo chat):

1. Jira settings > Apps > **GateReady demo data** > **Reset demo scenario**. This resets both gate plans and clears check results and history.
2. In the EVB project, delete any work items whose summary starts with `[Process Design]` (gap items from earlier runs).
3. Set the site language to English for the recording account (Atlassian account > Account preferences > Language) so Jira's own menus are in English.
4. Browser at 1920 x 1080, zoom 100%, bookmarks bar hidden, Rovo chat closed.

## Scenes

Each numbered line is one subtitle. Read them as written; the pause between lines is where the action happens on screen.

### 1. Title (0:00 to 0:08)

Screen: title card "GateReady. Know before the gate review."

1. GateReady. Know before the gate review.

### 2. The problem (0:08 to 0:32)

Screen: EVB Confluence space page tree, open the PFMEA page, then the Jira board.

2. Automotive suppliers develop parts through phase gates. Before each gate review, a quality engineer checks by hand that every piece of evidence is in place.
3. Is the PFMEA approved? Does the Control Plan reflect the last design change? Is any high-risk item still open?
4. The evidence already lives in Confluence and Jira. Checking it takes hours, and what gets missed shows up in the review or in a customer audit.

### 3. One click, a real answer (0:32 to 1:05)

Screen: Brake Sensor Housing > GateReady. Select **Check all gates**. Wait for the bars. Scroll to the verdict banner and the Needs review row.

5. GateReady is a Forge app inside the Jira project. One click checks every gate against live Jira and Confluence data.
6. Brake Sensor Housing is 88 percent ready for the Process Design gate.
7. GateReady checks validity, not just existence. The PFMEA is approved and has every required section, but Recommended Actions only says "TBD". So it asks a person to look.

### 4. Same template, different project (1:05 to 1:35)

Screen: EV Battery Bracket > GateReady. Select **Check all gates**. Show the red banner, then scroll the table slowly.

8. EV Battery Bracket uses the same template and sits at the same gate. It is 38 percent ready.
9. The PFMEA is still in progress. The Control Plan is approved, but older than the last design change. The MSA plan is missing, and two high-risk items are open.
10. Every verdict comes with the finding and a link to the evidence.

### 5. Gaps become owned work (1:35 to 1:58)

Screen: select **Create work items for 5 gaps**, review the list, confirm. Open one created item.

11. Each gap becomes a Jira work item, assigned to the owner of that evidence, with the finding and links attached.
12. Run it again and nothing is duplicated.

### 6. Close a gap, see the change (1:58 to 2:25)

Screen: open the EVB Control Plan in Confluence, add a sentence, publish. Back in GateReady select **Run check**. Show "38% to 50%" and scroll to **Check history**.

13. The owner updates the Control Plan. Check again.
14. Readiness moves from 38 to 50 percent, and GateReady shows exactly which requirement changed.
15. Every check is kept in the gate's history: when, by whom, and how ready it was. That is the audit trail.

### 7. Nothing is hard-coded (2:25 to 2:55)

Screen: Project settings > Apps > GateReady settings. Scroll the gates. Select **Edit** on "Control Plan reflects the latest design change", open the Rule dropdown to show the six rules, cancel. Show the space key and last design change fields.

16. Gates, rules, owners and the linked Confluence space are configured per project.
17. Six rule types cover documents and work items: exists, approved, up to date, required sections, all done, and none open.
18. Start from the APQP template, copy another project's plan, or build your own.

### 8. The Gate Review Agent (2:55 to 3:50)

Screen: open Rovo chat, choose **Gate Review Agent**.

Type: `Is EVB ready for its current gate?`

19. The Gate Review Agent runs the same deterministic check in conversation and explains each finding.

Type: `Is the PFMEA in EVB good enough?`

20. Rules cannot judge whether content is good enough, so the agent reads the document and gives an opinion, clearly marked as advisory. It never changes a verdict.

Type: `Draft the gate review summary for EVB.` Confirm when asked. Open the draft link.

21. Before it writes anything, it shows what it will create and asks.
22. The review summary is waiting as a Confluence draft: readiness, open gaps, the evidence checklist, and a place for the decision.

### 9. Pass the gate (3:50 to 4:10)

Screen: Brake Sensor Housing > GateReady. Select **Record gate as passed**, confirm. The project moves to Validation.

23. After the review, record the gate as passed. GateReady saves the date and the readiness at that moment, and moves the project to its next gate.

### 10. Built for the platform (4:10 to 4:28)

Screen: slide "Built on Atlassian Forge" with four lines: Rovo agent with six actions; MCP server; reusable skill; Runs on Atlassian.

24. The same six actions are exposed as an MCP server and packaged as a reusable skill, so other agents can prepare gate reviews too.
25. GateReady runs entirely on Atlassian. No data leaves the platform.

### 11. Close (4:28 to 4:40)

Screen: title card with the repository address.

26. GateReady. For quality engineers and project managers who need to know before the gate review, not during it.

## Notes

- If Rovo takes long to answer, cut the waiting time in editing. Keep each answer on screen for at least three seconds.
- Whenever a readiness number changes, hold the shot for two seconds.
- The Control Plan edit in scene 6 must be a real edit: the rule compares the page's last edit time with the project's last design change date.
