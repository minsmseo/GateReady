import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  DatePicker,
  DynamicTable,
  EmptyState,
  Heading,
  HelperMessage,
  Inline,
  Label,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Select,
  Stack,
  Text,
  TextArea,
  Textfield,
  UserPicker,
  xcss,
} from '@forge/react';
import { DEFAULT_APPROVED_STATES, FRESH_SINCE, RULE_TYPES, RULE_TYPE_KEYS, isConfluenceRule, newId, validateRequirement } from '../domain/ruleTypes.js';
import { call, ErrorBanner, Loading, Page } from './shared';

/**
 * Project settings: the gate plan. Project administrators define the gates,
 * the evidence each gate needs, and who owns each piece of evidence.
 */

const cardStyle = xcss({
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
});
const fieldStyle = xcss({ width: '260px' });
const wideFieldStyle = xcss({ width: '360px' });

const RULE_OPTIONS = RULE_TYPE_KEYS.map((key) => ({ label: RULE_TYPES[key].label, value: key }));
const SINCE_OPTIONS = [
  { label: 'The last design change (project setting)', value: FRESH_SINCE.DESIGN_CHANGE },
  { label: 'The date the previous gate was passed', value: FRESH_SINCE.PREVIOUS_GATE },
  { label: 'A fixed date', value: FRESH_SINCE.FIXED_DATE },
];

// The date picker shows a bogus date for an empty string, so "no date" must be undefined.
const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : undefined);
const fromDateInput = (value) => (value ? `${value}T00:00:00.000Z` : null);
const splitList = (value, separator) => String(value || '').split(separator).map((part) => part.trim()).filter(Boolean);

/** One-line description of what a requirement looks for. */
const describeRule = (requirement) => {
  const params = requirement.params || {};
  if (!isConfluenceRule(requirement.ruleType)) return `JQL: ${params.jql || ''}`;
  const target = [params.label ? `label "${params.label}"` : null, params.title ? `title contains "${params.title}"` : null]
    .filter(Boolean)
    .join(', ');
  if (requirement.ruleType === 'confluence_page_sections') return `Page with ${target}; sections: ${(params.sections || []).join(', ')}`;
  if (requirement.ruleType === 'confluence_page_approved') {
    return `Page with ${target}; status in: ${(params.approvedStates?.length ? params.approvedStates : DEFAULT_APPROVED_STATES).join(', ')}`;
  }
  if (requirement.ruleType === 'confluence_page_fresh') {
    const since = SINCE_OPTIONS.find((option) => option.value === params.since)?.label.toLowerCase() || 'a reference date';
    return `Page with ${target}; edited after ${since}${params.since === FRESH_SINCE.FIXED_DATE ? ` (${toDateInput(params.date)})` : ''}`;
  }
  return `Page with ${target}`;
};

const blankRequirement = () => ({
  id: newId('req'),
  title: '',
  ruleType: 'confluence_page_exists',
  params: {},
  owner: null,
});

/** Add or edit one evidence requirement. */
const RequirementModal = ({ initial, isNew, onSave, onClose }) => {
  const [draft, setDraft] = useState(initial);
  const [problems, setProblems] = useState([]);
  const params = draft.params || {};
  const setParam = (key, value) => setDraft((current) => ({ ...current, params: { ...current.params, [key]: value } }));
  const confluence = isConfluenceRule(draft.ruleType);

  const save = () => {
    const found = validateRequirement(draft);
    if (found.length) {
      setProblems(found);
      return;
    }
    onSave(draft);
  };

  return (
    <Modal onClose={onClose} width="large">
      <ModalHeader>
        <ModalTitle>{isNew ? 'Add evidence requirement' : 'Edit evidence requirement'}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.200">
          {problems.length > 0 && (
            <SectionMessage appearance="error" title="This requirement is not complete">
              <List type="unordered">
                {problems.map((problem) => (
                  <ListItem key={problem}>{problem}</ListItem>
                ))}
              </List>
            </SectionMessage>
          )}
          <Stack space="space.050">
            <Label labelFor="req-title">Title</Label>
            <Textfield id="req-title" value={draft.title} placeholder="PFMEA is approved" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Stack>
          <Stack space="space.050">
            <Label labelFor="req-rule">Rule</Label>
            <Select
              inputId="req-rule"
              options={RULE_OPTIONS}
              value={RULE_OPTIONS.find((option) => option.value === draft.ruleType)}
              onChange={(option) => setDraft({ ...draft, ruleType: option.value })}
            />
            <HelperMessage>{RULE_TYPES[draft.ruleType]?.summary}</HelperMessage>
          </Stack>

          {confluence ? (
            <>
              <Inline space="space.200">
                <Stack space="space.050">
                  <Label labelFor="req-label">Page label</Label>
                  <Textfield id="req-label" value={params.label || ''} placeholder="pfmea" onChange={(e) => setParam('label', e.target.value)} />
                </Stack>
                <Stack space="space.050">
                  <Label labelFor="req-page-title">Or title contains</Label>
                  <Textfield id="req-page-title" value={params.title || ''} placeholder="PFMEA" onChange={(e) => setParam('title', e.target.value)} />
                </Stack>
              </Inline>
              <HelperMessage>
                GateReady looks in the Confluence space linked to this project. If several pages match, the most recently edited one is used.
              </HelperMessage>
            </>
          ) : (
            <Stack space="space.050">
              <Label labelFor="req-jql">JQL filter</Label>
              <TextArea id="req-jql" value={params.jql || ''} placeholder="labels = gate-3" onChange={(e) => setParam('jql', e.target.value)} />
              <HelperMessage>Write only the filter. GateReady limits it to this project automatically.</HelperMessage>
            </Stack>
          )}

          {draft.ruleType === 'confluence_page_approved' && (
            <Stack space="space.050">
              <Label labelFor="req-states">Approved statuses</Label>
              <Textfield
                id="req-states"
                value={(params.approvedStates || []).join(', ')}
                placeholder={DEFAULT_APPROVED_STATES.join(', ')}
                onChange={(e) => setParam('approvedStates', splitList(e.target.value, ','))}
              />
              <HelperMessage>Comma separated Confluence page statuses that count as approved. Leave empty for Approved, Verified.</HelperMessage>
            </Stack>
          )}

          {draft.ruleType === 'confluence_page_sections' && (
            <Stack space="space.050">
              <Label labelFor="req-sections">Required section headings</Label>
              <TextArea
                id="req-sections"
                value={(params.sections || []).join('\n')}
                placeholder={'Failure Mode\nCurrent Controls'}
                onChange={(e) => setParam('sections', String(e.target.value).split('\n'))}
              />
              <HelperMessage>One heading per line. A heading that exists but has no content is reported as "Needs review".</HelperMessage>
            </Stack>
          )}

          {draft.ruleType === 'confluence_page_fresh' && (
            <Inline space="space.200">
              <Stack space="space.050">
                <Label labelFor="req-since">Must be edited after</Label>
                <Box xcss={wideFieldStyle}>
                  <Select
                    inputId="req-since"
                    options={SINCE_OPTIONS}
                    value={SINCE_OPTIONS.find((option) => option.value === params.since)}
                    onChange={(option) => setParam('since', option.value)}
                  />
                </Box>
              </Stack>
              {params.since === FRESH_SINCE.FIXED_DATE && (
                <Stack space="space.050">
                  <Label labelFor="req-date">Date</Label>
                  <DatePicker id="req-date" value={toDateInput(params.date)} onChange={(value) => setParam('date', fromDateInput(value))} />
                </Stack>
              )}
            </Inline>
          )}

          <Stack space="space.050">
            <UserPicker
              label="Owner"
              name="owner"
              placeholder="Who provides this evidence?"
              defaultValue={draft.owner?.accountId}
              onChange={(user) => setDraft({ ...draft, owner: user?.id ? { accountId: user.id, displayName: user.name || '' } : null })}
            />
            <HelperMessage>Gap work items for this requirement are assigned to the owner.</HelperMessage>
          </Stack>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={save}>
            {isNew ? 'Add requirement' : 'Apply'}
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </Modal>
  );
};

const ConfirmModal = ({ title, body, confirmLabel, busy, onConfirm, onClose }) => (
  <Modal onClose={onClose}>
    <ModalHeader>
      <ModalTitle appearance="warning">{title}</ModalTitle>
    </ModalHeader>
    <ModalBody>
      <Text>{body}</Text>
    </ModalBody>
    <ModalFooter>
      <ButtonGroup>
        <Button appearance="subtle" onClick={onClose} isDisabled={busy}>
          Cancel
        </Button>
        <Button appearance="warning" onClick={onConfirm} isLoading={busy}>
          {confirmLabel}
        </Button>
      </ButtonGroup>
    </ModalFooter>
  </Modal>
);

const GateCard = ({ gate, index, count, canEdit, onChange, onMove, onDelete, onEditRequirement, onDeleteRequirement, onAddRequirement }) => {
  const rows = gate.requirements.map((requirement) => ({
    key: requirement.id,
    cells: [
      { key: 'title', content: <Text weight="medium">{requirement.title}</Text> },
      { key: 'rule', content: <Text>{RULE_TYPES[requirement.ruleType]?.label || 'Unknown rule'}</Text> },
      { key: 'detail', content: <Text>{describeRule(requirement)}</Text> },
      { key: 'owner', content: <Text>{requirement.owner?.displayName || 'No owner'}</Text> },
      {
        key: 'actions',
        content: canEdit ? (
          <ButtonGroup>
            <Button appearance="subtle" spacing="compact" onClick={() => onEditRequirement(requirement)}>
              Edit
            </Button>
            <Button appearance="subtle" spacing="compact" onClick={() => onDeleteRequirement(requirement)}>
              Remove
            </Button>
          </ButtonGroup>
        ) : null,
      },
    ],
  }));

  return (
    <Box xcss={cardStyle}>
      <Stack space="space.200">
        <Inline space="space.200" alignBlock="end" spread="space-between">
          <Inline space="space.200" alignBlock="end">
            <Stack space="space.050">
              <Label labelFor={`gate-name-${gate.id}`}>{`Gate ${index + 1}`}</Label>
              <Box xcss={fieldStyle}>
                <Textfield id={`gate-name-${gate.id}`} value={gate.name} isDisabled={!canEdit} onChange={(e) => onChange({ ...gate, name: e.target.value })} />
              </Box>
            </Stack>
            <Stack space="space.050">
              <Label labelFor={`gate-passed-${gate.id}`}>Passed on</Label>
              <DatePicker
                id={`gate-passed-${gate.id}`}
                value={toDateInput(gate.passedOn)}
                isDisabled={!canEdit}
                onChange={(value) => onChange({ ...gate, passedOn: fromDateInput(value) })}
              />
            </Stack>
          </Inline>
          {canEdit && (
            <ButtonGroup>
              <Button spacing="compact" isDisabled={index === 0} onClick={() => onMove(-1)}>
                Move up
              </Button>
              <Button spacing="compact" isDisabled={index === count - 1} onClick={() => onMove(1)}>
                Move down
              </Button>
              <Button spacing="compact" appearance="subtle" onClick={onDelete}>
                Delete gate
              </Button>
            </ButtonGroup>
          )}
        </Inline>
        <DynamicTable
          head={{
            cells: [
              { key: 'title', content: 'Evidence requirement', width: 24 },
              { key: 'rule', content: 'Rule', width: 18 },
              { key: 'detail', content: 'Looks for', width: 32 },
              { key: 'owner', content: 'Owner', width: 12 },
              { key: 'actions', content: '', width: 14 },
            ],
          }}
          rows={rows}
          emptyView={<Text>No evidence requirements yet. A gate without requirements cannot be checked.</Text>}
        />
        {canEdit && (
          <Inline>
            <Button onClick={onAddRequirement}>Add requirement</Button>
          </Inline>
        )}
      </Stack>
    </Box>
  );
};

const App = () => {
  const [settings, setSettings] = useState(null);
  const [plan, setPlan] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [space, setSpace] = useState(null);
  const [copySource, setCopySource] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await call('getSettings');
      setSettings(data);
      setPlan(data.plan);
      setDirty(false);
      setLoadError(null);
    } catch (failure) {
      setLoadError(failure.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (next) => {
    setPlan(next);
    setDirty(true);
    setSaved(false);
  };
  const updateGate = (gateId, change) => update({ ...plan, gates: plan.gates.map((gate) => (gate.id === gateId ? change(gate) : gate)) });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const stored = await call('savePlan', { plan });
      setPlan(stored);
      setDirty(false);
      setSaved(true);
    } catch (failure) {
      setError(failure.message);
    }
    setSaving(false);
  };

  const loadTemplate = async (source) => {
    setConfirm((current) => (current ? { ...current, busy: true } : current));
    setError(null);
    try {
      const stored = await call('loadTemplate', { source });
      setPlan(stored);
      setDirty(false);
      setSaved(true);
    } catch (failure) {
      setError(failure.message);
    }
    setConfirm(null);
  };

  const requestTemplate = (source, label) => {
    if (!plan) {
      loadTemplate(source);
      return;
    }
    setConfirm({
      title: 'Replace the current gates?',
      body: `All gates and requirements of this project will be replaced with ${label}. The linked space and design change date are kept. Earlier check results will be marked as out of date.`,
      confirmLabel: 'Replace gates',
      onConfirm: () => loadTemplate(source),
    });
  };

  const verifySpace = async () => {
    setSpace({ busy: true });
    try {
      setSpace(await call('checkSpace', { spaceKey: plan.spaceKey }));
    } catch (failure) {
      setSpace({ found: false, error: failure.message });
    }
  };

  if (loadError) {
    return (
      <Page>
        <ErrorBanner title="GateReady settings could not be loaded" message={loadError} />
        <Inline>
          <Button onClick={load}>Try again</Button>
        </Inline>
      </Page>
    );
  }
  if (!settings) return <Loading label="Loading gate plan" />;

  const { canEdit, otherProjects } = settings;
  const copyOptions = otherProjects.map((other) => ({ label: `${other.projectKey} (${other.gates} gates)`, value: other.projectId }));

  const templateButtons = (
    <Inline space="space.100" alignBlock="center">
      <Button appearance={plan ? 'default' : 'primary'} onClick={() => requestTemplate('apqp', 'the built-in APQP template')}>
        {plan ? 'Replace with APQP template' : 'Start with the APQP template'}
      </Button>
      {copyOptions.length > 0 && (
        <>
          <Box xcss={fieldStyle}>
            <Select inputId="copy-source" placeholder="Copy from project" options={copyOptions} value={copySource} onChange={setCopySource} />
          </Box>
          <Button isDisabled={!copySource} onClick={() => requestTemplate(copySource.value, `the gates of ${copySource.label}`)}>
            Copy gates
          </Button>
        </>
      )}
    </Inline>
  );

  if (!plan) {
    return (
      <Page>
        <ErrorBanner message={error} />
        <EmptyState
          header="This project has no gate plan yet"
          description={
            canEdit
              ? 'A gate plan lists the phase gates of this project and the evidence each gate needs. Start from the APQP template or copy the plan of another project, then adjust it.'
              : 'Ask a project administrator to set up the gate plan.'
          }
        />
        {canEdit && templateButtons}
        <ModalTransition>{confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}</ModalTransition>
      </Page>
    );
  }

  const gateOptions = plan.gates.map((gate, index) => ({ label: `${index + 1}. ${gate.name || 'Unnamed gate'}`, value: gate.id }));

  return (
    <Page>
      {!canEdit && (
        <SectionMessage appearance="information" title="View only">
          <Text>Only project administrators can change the gate plan.</Text>
        </SectionMessage>
      )}
      <ErrorBanner title="The gate plan could not be saved" message={error} />
      {saved && !dirty && (
        <SectionMessage appearance="success" title="Gate plan saved">
          <Text>Open GateReady in the project navigation and run a check to see the effect.</Text>
        </SectionMessage>
      )}

      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Heading as="h3">Project evidence sources</Heading>
          <Inline space="space.300" alignBlock="start">
            <Stack space="space.050">
              <Label labelFor="space-key">Confluence space key</Label>
              <Inline space="space.100" alignBlock="center">
                <Box xcss={fieldStyle}>
                  <Textfield
                    id="space-key"
                    value={plan.spaceKey || ''}
                    placeholder="e.g. BSH"
                    isDisabled={!canEdit}
                    onChange={(e) => {
                      setSpace(null);
                      update({ ...plan, spaceKey: e.target.value });
                    }}
                  />
                </Box>
                <Button onClick={verifySpace} isLoading={Boolean(space?.busy)} isDisabled={!plan.spaceKey}>
                  Verify
                </Button>
              </Inline>
              <HelperMessage>
                {space && !space.busy
                  ? space.found
                    ? `Found space "${space.name}".`
                    : space.error || 'No space with this key is visible to you.'
                  : 'Document rules look for pages in this space.'}
              </HelperMessage>
            </Stack>
            <Stack space="space.050">
              <Label labelFor="baseline">Last design change</Label>
              <DatePicker
                id="baseline"
                value={toDateInput(plan.baselineDate)}
                isDisabled={!canEdit}
                onChange={(value) => update({ ...plan, baselineDate: fromDateInput(value) })}
              />
              <HelperMessage>"Up to date" rules require documents edited after this date.</HelperMessage>
            </Stack>
            <Stack space="space.050">
              <Label labelFor="current-gate">Current gate</Label>
              <Box xcss={fieldStyle}>
                <Select
                  inputId="current-gate"
                  options={gateOptions}
                  value={gateOptions.find((option) => option.value === plan.currentGateId)}
                  isDisabled={!canEdit}
                  onChange={(option) => update({ ...plan, currentGateId: option.value })}
                />
              </Box>
              <HelperMessage>The gate the team is preparing for.</HelperMessage>
            </Stack>
          </Inline>
        </Stack>
      </Box>

      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050">
          <Heading as="h3">Gates and evidence requirements</Heading>
          <Text>{`Template: ${plan.templateName}`}</Text>
        </Stack>
        {canEdit && templateButtons}
      </Inline>

      {plan.gates.map((gate, index) => (
        <GateCard
          key={gate.id}
          gate={gate}
          index={index}
          count={plan.gates.length}
          canEdit={canEdit}
          onChange={(next) => updateGate(gate.id, () => next)}
          onMove={(direction) => {
            const gates = [...plan.gates];
            const [moved] = gates.splice(index, 1);
            gates.splice(index + direction, 0, moved);
            update({ ...plan, gates });
          }}
          onDelete={() =>
            setConfirm({
              title: `Delete the ${gate.name || 'unnamed'} gate?`,
              body: `The gate and its ${gate.requirements.length} requirements are removed when you save.`,
              confirmLabel: 'Delete gate',
              onConfirm: () => {
                update({ ...plan, gates: plan.gates.filter((candidate) => candidate.id !== gate.id) });
                setConfirm(null);
              },
            })
          }
          onAddRequirement={() => setEditing({ gateId: gate.id, requirement: blankRequirement(), isNew: true })}
          onEditRequirement={(requirement) => setEditing({ gateId: gate.id, requirement, isNew: false })}
          onDeleteRequirement={(requirement) =>
            updateGate(gate.id, (current) => ({ ...current, requirements: current.requirements.filter((candidate) => candidate.id !== requirement.id) }))
          }
        />
      ))}

      {canEdit && (
        <Inline spread="space-between" alignBlock="center">
          <Button
            onClick={() =>
              update({ ...plan, templateName: 'Custom', gates: [...plan.gates, { id: newId('gate'), name: '', description: '', passedOn: null, requirements: [] }] })
            }
          >
            Add gate
          </Button>
          <ButtonGroup>
            <Button appearance="subtle" isDisabled={!dirty || saving} onClick={load}>
              Discard changes
            </Button>
            <Button appearance="primary" isDisabled={!dirty} isLoading={saving} onClick={save}>
              Save gate plan
            </Button>
          </ButtonGroup>
        </Inline>
      )}
      {dirty && <Text>You have unsaved changes.</Text>}

      <ModalTransition>
        {editing && (
          <RequirementModal
            initial={editing.requirement}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
            onSave={(requirement) => {
              updateGate(editing.gateId, (gate) => ({
                ...gate,
                requirements: editing.isNew
                  ? [...gate.requirements, requirement]
                  : gate.requirements.map((candidate) => (candidate.id === requirement.id ? requirement : candidate)),
              }));
              setEditing(null);
            }}
          />
        )}
        {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
      </ModalTransition>
    </Page>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
