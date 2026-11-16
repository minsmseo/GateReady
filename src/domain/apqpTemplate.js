import { FRESH_SINCE, newId } from './ruleTypes.js';

/**
 * Built-in starting point: the five APQP phases with typical evidence for
 * each gate. Uses only generic, public APQP/PPAP terms. Teams are expected
 * to edit it in project settings; nothing in the engine depends on these
 * specific gates or labels.
 *
 * Jira rules hold only the filter part of the JQL. The engine always scopes
 * it to the current project, which is why one template gives different
 * results in different projects.
 */
const page = (title, ruleType, label, extra = {}) => ({ title, ruleType, params: { label, ...extra } });
const jira = (title, ruleType, jql) => ({ title, ruleType, params: { jql } });

const GATES = [
  {
    name: 'Plan and Define',
    description: 'Customer requirements are understood and the program is planned.',
    requirements: [
      page('Program plan exists', 'confluence_page_exists', 'program-plan'),
      page('Customer requirements are approved', 'confluence_page_approved', 'customer-requirements'),
      jira('Planning tasks are complete', 'jira_query_all_done', 'labels = gate-1'),
    ],
  },
  {
    name: 'Product Design',
    description: 'The product design is verified and design risks are addressed.',
    requirements: [
      page('DFMEA is approved', 'confluence_page_approved', 'dfmea'),
      page('DFMEA covers the required sections', 'confluence_page_sections', 'dfmea', {
        sections: ['Function', 'Failure Mode', 'Effects', 'Causes', 'Current Controls', 'Recommended Actions'],
      }),
      page('Design verification plan exists', 'confluence_page_exists', 'dvp'),
      jira('Design review actions are closed', 'jira_query_all_done', 'labels = gate-2'),
    ],
  },
  {
    name: 'Process Design',
    description: 'The manufacturing process is defined and process risks are controlled.',
    requirements: [
      page('Process Flow Diagram exists', 'confluence_page_exists', 'process-flow'),
      page('PFMEA is approved', 'confluence_page_approved', 'pfmea'),
      page('PFMEA covers the required sections', 'confluence_page_sections', 'pfmea', {
        sections: ['Process Step', 'Failure Mode', 'Effects', 'Causes', 'Current Controls', 'Recommended Actions'],
      }),
      page('Control Plan is approved', 'confluence_page_approved', 'control-plan'),
      page('Control Plan reflects the latest design change', 'confluence_page_fresh', 'control-plan', {
        since: FRESH_SINCE.DESIGN_CHANGE,
      }),
      page('MSA plan exists', 'confluence_page_exists', 'msa-plan'),
      jira('Process design tasks are complete', 'jira_query_all_done', 'labels = gate-3'),
      jira('No unresolved high-risk items', 'jira_query_none_open', 'labels = high-risk AND statusCategory != Done'),
    ],
  },
  {
    name: 'Validation',
    description: 'Product and process are validated under production conditions.',
    requirements: [
      page('MSA Report is approved', 'confluence_page_approved', 'msa-report'),
      page('Production trial run report exists', 'confluence_page_exists', 'trial-run'),
      page('Part Submission Warrant is approved', 'confluence_page_approved', 'psw'),
      jira('Validation tasks are complete', 'jira_query_all_done', 'labels = gate-4'),
      jira('No unresolved high-risk items', 'jira_query_none_open', 'labels = high-risk AND statusCategory != Done'),
    ],
  },
  {
    name: 'Launch',
    description: 'Production is stable and lessons are captured.',
    requirements: [
      page('Lessons learned are documented', 'confluence_page_exists', 'lessons-learned'),
      page('Control Plan reflects the latest design change', 'confluence_page_fresh', 'control-plan', {
        since: FRESH_SINCE.DESIGN_CHANGE,
      }),
      jira('Launch tasks are complete', 'jira_query_all_done', 'labels = gate-5'),
    ],
  },
];

export const APQP_TEMPLATE_NAME = 'APQP (5 phases)';

/** Returns a fresh copy of the APQP gates with new ids. */
export const buildApqpGates = () =>
  GATES.map((gate) => ({
    id: newId('gate'),
    name: gate.name,
    description: gate.description,
    passedOn: null,
    requirements: gate.requirements.map((requirement) => ({
      id: newId('req'),
      title: requirement.title,
      ruleType: requirement.ruleType,
      params: { ...requirement.params },
      owner: null,
    })),
  }));
