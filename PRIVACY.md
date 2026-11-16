# GateReady privacy policy

Last updated: 16 November 2026

GateReady is an Atlassian Forge app that checks phase gate readiness from data in Jira and Confluence. This policy explains what the app does with data.

## Summary

- GateReady runs entirely on Atlassian's Forge platform.
- It does not send any data outside Atlassian. It has no external servers, no analytics and no third-party services.
- The developer of GateReady cannot see your Jira or Confluence content.

## Data the app reads

To judge evidence requirements, GateReady reads, with the permissions of the person using it:

- Jira work items matched by the JQL filters you configure (key, summary, status, assignee, priority)
- Confluence pages in the space you link to a project (title, labels, status, last edit time, and the page body when a rule or the agent needs it)
- Basic project and space details, and the current user's permissions

This data is processed in memory to produce a verdict. Page bodies are not stored.

## Data the app stores

GateReady stores the following in Forge hosted storage, inside your Atlassian site's app installation:

- The gate plan of each project: gates, evidence requirements, rule settings, the linked Confluence space key, dates you enter, and the Atlassian account ID of each requirement owner
- The latest check result for each gate: verdicts, findings, the titles and links of the pages and work items that were checked, and the Atlassian account ID of a work item's assignee
- Which Jira work item was raised for which gap
- The Atlassian account ID of the person who last ran a check or saved a plan

GateReady stores Atlassian account IDs only as references. It does not store names, email addresses, avatars or any other personal data. Names shown in the app are fetched from Jira at the moment they are displayed, with the permissions of the person looking.

## Logs

When a request to Jira or Confluence fails, GateReady writes a technical log line to Forge's app logs: the rule or action name, the HTTP status, and the API path that failed. A path can contain an identifier such as a page ID, a project ID or an account ID. Log lines never contain page content, work item text or names. Logs are kept by Atlassian under Forge's log retention rules, and a site administrator can turn off the developer's access to them at admin.atlassian.com.

## Data the app writes to your site

Only when a user asks for it:

- Jira work items for gaps, in the same project
- A Confluence draft page with the gate review summary, in the linked space
- Demo projects, spaces and pages, when a Jira administrator uses the demo data loader

## Rovo agent

The Gate Review Agent runs in Atlassian Rovo. When you chat with it, the results of GateReady's actions, including excerpts of Confluence pages, are passed to Rovo so it can answer. That processing is done by Atlassian under Atlassian's own terms and privacy policy. GateReady itself does not call any AI service.

## Retention and deletion

Stored data stays in Forge hosted storage until you uninstall the app. Uninstalling GateReady from the site removes the app's stored data according to Atlassian's Forge data retention rules. Work items and pages the app created in Jira and Confluence are your content and remain until you delete them.

## Sharing

GateReady does not sell, share or transfer data to anyone.

## Contact

Questions about this policy or the app: open an issue at https://github.com/minsmseo/GateReady/issues
