import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  DynamicTable,
  EmptyState,
  Heading,
  Inline,
  Link,
  List,
  ListItem,
  Lozenge,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  ProgressBar,
  SectionMessage,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  xcss,
} from '@forge/react';
import { call, ErrorBanner, formatDate, formatDateTime, Loading, Page, VerdictLozenge } from './shared';

/**
 * Project page: readiness of every gate, the findings behind each verdict,
 * and the actions a quality engineer takes before a gate review.
 */

const cardStyle = xcss({
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
});
const barStyle = xcss({ width: '240px' });
const nameStyle = xcss({ width: '200px' });

/** Where a gate sits relative to the project's current gate. */
const gatePhase = (plan, gate, index) => {
  const currentIndex = plan.gates.findIndex((candidate) => candidate.id === plan.currentGateId);
  if (gate.passedOn) return { label: `Passed ${formatDate(gate.passedOn)}`, appearance: 'success' };
  if (index === currentIndex) return { label: 'Current gate', appearance: 'inprogress' };
  return { label: index < currentIndex ? 'Not recorded as passed' : 'Upcoming', appearance: 'default' };
};

const GateOverviewRow = ({ plan, gate, index, result, busy }) => {
  const phase = gatePhase(plan, gate, index);
  const summary = result?.summary;
  return (
    <Inline space="space.200" alignBlock="center">
      <Box xcss={nameStyle}>
        <Text weight="bold">{`${index + 1}. ${gate.name}`}</Text>
      </Box>
      <Box xcss={barStyle}>
        <ProgressBar
          value={summary ? summary.readiness / 100 : 0}
          appearance={summary && summary.readiness === 100 ? 'success' : 'default'}
          isIndeterminate={busy}
          ariaLabel={`${gate.name} readiness`}
        />
      </Box>
      <Text>
        {summary
          ? `${summary.readiness}% ready - ${summary.met} of ${summary.total} met`
          : gate.requirements.length
            ? 'Not checked yet'
            : 'No requirements'}
      </Text>
      {summary && summary.notMet > 0 && <Lozenge appearance="removed">{`${summary.notMet} not met`}</Lozenge>}
      {summary && summary.needsReview > 0 && <Lozenge appearance="moved">{`${summary.needsReview} to review`}</Lozenge>}
      <Lozenge appearance={phase.appearance}>{phase.label}</Lozenge>
    </Inline>
  );
};

const EvidenceLinks = ({ evidence }) => {
  if (!evidence?.length) return <Text>-</Text>;
  return (
    <Stack space="space.050">
      {evidence.map((item) => (
        <Text key={`${item.type}-${item.id}`}>
          {item.url ? (
            <Link href={item.url} openNewTab>
              {item.title}
            </Link>
          ) : (
            item.title
          )}
          {item.detail ? ` (${item.detail})` : ''}
        </Text>
      ))}
    </Stack>
  );
};

const GateDetail = ({ gate, result, gaps, history, siteUrl, canEdit, busy, onRun, onRaise, onPass }) => {
  if (!gate.requirements.length) {
    return (
      <EmptyState
        header="This gate has no evidence requirements"
        description="Add requirements in GateReady settings (Project settings > GateReady settings) to define what this gate needs."
      />
    );
  }
  if (!result) {
    return (
      <EmptyState
        header="This gate has not been checked yet"
        description={`GateReady will read Jira and Confluence and judge ${gate.requirements.length} requirements.`}
        primaryAction={
          <Button appearance="primary" onClick={onRun} isLoading={busy}>
            Run check
          </Button>
        }
      />
    );
  }

  const openGaps = result.items.filter((item) => item.verdict === 'not_met');
  const unraised = openGaps.filter((item) => !gaps[item.requirementId]);
  const rows = result.items.map((item) => {
    const gap = gaps[item.requirementId];
    return {
      key: item.requirementId,
      cells: [
        { key: 'title', content: <Text weight="medium">{item.title}</Text> },
        { key: 'verdict', content: <VerdictLozenge verdict={item.verdict} /> },
        { key: 'reason', content: <Text>{item.reason}</Text> },
        { key: 'evidence', content: <EvidenceLinks evidence={item.evidence} /> },
        { key: 'owner', content: <Text>{item.owner?.displayName || 'No owner'}</Text> },
        {
          key: 'gap',
          content: gap ? (
            <Link href={`${siteUrl}/browse/${gap.issueKey}`} openNewTab>
              {gap.issueKey}
            </Link>
          ) : (
            <Text>-</Text>
          ),
        },
      ],
    };
  });

  return (
    <Stack space="space.200">
      <Inline space="space.200" alignBlock="center" spread="space-between">
        <Text>{`Last checked ${formatDateTime(result.checkedAt)}`}</Text>
        <ButtonGroup>
          {openGaps.length > 0 && (
            <Button onClick={() => onRaise(openGaps)} isDisabled={busy}>
              {unraised.length ? `Create work items for ${unraised.length} gap${unraised.length === 1 ? '' : 's'}` : 'Review gap work items'}
            </Button>
          )}
          <Button appearance="primary" onClick={onRun} isLoading={busy}>
            Run check
          </Button>
        </ButtonGroup>
      </Inline>
      {result.stale && (
        <SectionMessage appearance="warning" title="The gate plan changed after this check">
          <Text>Run the check again to judge the current requirements.</Text>
        </SectionMessage>
      )}
      <GateVerdict gate={gate} result={result} canEdit={canEdit} busy={busy} onPass={onPass} />
      <ChangesSinceLastCheck result={result} />
      <DynamicTable
        head={{
          cells: [
            { key: 'title', content: 'Requirement', width: 20 },
            { key: 'verdict', content: 'Verdict', width: 10 },
            { key: 'reason', content: 'Finding', width: 30 },
            { key: 'evidence', content: 'Evidence', width: 20 },
            { key: 'owner', content: 'Owner', width: 10 },
            { key: 'gap', content: 'Gap item', width: 10 },
          ],
        }}
        rows={rows}
      />
      <CheckHistory history={history} />
    </Stack>
  );
};

/**
 * The one-line answer to "can this gate go to review?", with the action
 * that follows from it.
 */
const GateVerdict = ({ gate, result, canEdit, busy, onPass }) => {
  const { summary } = result;
  if (gate.passedOn) {
    const at = gate.passedReadiness === null || gate.passedReadiness === undefined ? '' : ` at ${gate.passedReadiness}% readiness`;
    return (
      <SectionMessage appearance="success" title={`Gate passed on ${formatDate(gate.passedOn)}${at}`}>
        <Text>This gate is recorded as passed. Checks still run against live data, so you can confirm the evidence stays in place.</Text>
      </SectionMessage>
    );
  }

  const passButton = canEdit ? (
    <Inline>
      <Button onClick={onPass} isDisabled={busy} appearance={summary.notMet === 0 && summary.needsReview === 0 ? 'primary' : 'default'}>
        Record gate as passed
      </Button>
    </Inline>
  ) : null;

  if (summary.notMet > 0) {
    return (
      <SectionMessage appearance="error" title={`Not ready for gate review: ${summary.notMet} gap${summary.notMet === 1 ? '' : 's'}`}>
        <Stack space="space.100">
          <Text>
            {`${summary.met} of ${summary.total} evidence requirements are met.${
              summary.needsReview ? ` ${summary.needsReview} more need a reviewer's judgement.` : ''
            } Assign the gaps to their owners, then run the check again.`}
          </Text>
          {passButton}
        </Stack>
      </SectionMessage>
    );
  }
  if (summary.needsReview > 0) {
    return (
      <SectionMessage appearance="warning" title={`Evidence is in place, ${summary.needsReview} item${summary.needsReview === 1 ? ' needs' : 's need'} a reviewer's judgement`}>
        <Stack space="space.100">
          <Text>No requirement is failing. The items marked "Needs review" cannot be decided by a rule; look at them before the gate decision.</Text>
          {passButton}
        </Stack>
      </SectionMessage>
    );
  }
  return (
    <SectionMessage appearance="success" title="Ready for gate review">
      <Stack space="space.100">
        <Text>{`All ${summary.total} evidence requirements are met.`}</Text>
        {passButton}
      </Stack>
    </SectionMessage>
  );
};

const VERDICT_WORD = { met: 'Met', not_met: 'Not met', needs_review: 'Needs review' };

/** What moved since the previous check of this gate. */
const ChangesSinceLastCheck = ({ result }) => {
  const previous = result.previous;
  if (!previous || !previous.changes?.length) return null;
  const improved = result.summary.readiness >= previous.readiness;
  return (
    <SectionMessage
      appearance={improved ? 'information' : 'warning'}
      title={`Since the check on ${formatDateTime(previous.checkedAt)}: ${previous.readiness}% to ${result.summary.readiness}%`}
    >
      <List type="unordered">
        {previous.changes.map((change) => (
          <ListItem key={change.requirementId}>{`${change.title}: ${VERDICT_WORD[change.from] || change.from} to ${VERDICT_WORD[change.to] || change.to}`}</ListItem>
        ))}
      </List>
    </SectionMessage>
  );
};

/** Audit trail: the last checks of this gate. */
const CheckHistory = ({ history }) => {
  if (!history?.length) return null;
  return (
    <Stack space="space.100">
      <Heading as="h4">Check history</Heading>
      <DynamicTable
        head={{
          cells: [
            { key: 'when', content: 'Checked', width: 25 },
            { key: 'who', content: 'By', width: 25 },
            { key: 'readiness', content: 'Readiness', width: 15 },
            { key: 'counts', content: 'Met / Not met / Needs review', width: 35 },
          ],
        }}
        rows={history.map((entry) => ({
          key: entry.checkedAt,
          cells: [
            { key: 'when', content: <Text>{formatDateTime(entry.checkedAt)}</Text> },
            { key: 'who', content: <Text>{entry.checkedByName || 'Gate Review Agent or automation'}</Text> },
            { key: 'readiness', content: <Text weight="medium">{`${entry.readiness}%`}</Text> },
            { key: 'counts', content: <Text>{`${entry.met} / ${entry.notMet} / ${entry.needsReview} of ${entry.total}`}</Text> },
          ],
        }))}
      />
    </Stack>
  );
};

/** Confirmation before a gate is recorded as passed. */
const PassGateModal = ({ gate, summary, busy, onConfirm, onClose }) => {
  const clean = summary.notMet === 0 && summary.needsReview === 0;
  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle appearance={clean ? undefined : 'warning'}>{`Record the ${gate.name} gate as passed?`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150">
          <Text>
            {clean
              ? `All ${summary.total} evidence requirements are met.`
              : `${[
                  summary.notMet ? `${summary.notMet} requirement${summary.notMet === 1 ? ' is' : 's are'} not met` : null,
                  summary.needsReview ? `${summary.needsReview} requirement${summary.needsReview === 1 ? ' needs' : 's need'} a reviewer's judgement` : null,
                ]
                  .filter(Boolean)
                  .join(' and ')}. Passing with open items is a decision for the gate review; the readiness of ${summary.readiness}% is recorded with the gate.`}
          </Text>
          <Text>Today is saved as the pass date and the project moves on to the next gate. You can change the date in GateReady settings.</Text>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ButtonGroup>
          <Button appearance="subtle" onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button appearance={clean ? 'primary' : 'warning'} onClick={onConfirm} isLoading={busy}>
            Record as passed
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </Modal>
  );
};

/** Confirmation before anything is written to Jira. */
const RaiseGapsModal = ({ gate, items, gaps, busy, outcome, onConfirm, onClose }) => (
  <Modal onClose={onClose} width="large">
    <ModalHeader>
      <ModalTitle>{outcome ? 'Gap work items' : `Create work items for ${gate.name} gaps`}</ModalTitle>
    </ModalHeader>
    <ModalBody>
      {outcome ? (
        <Stack space="space.150">
          {outcome.created.length > 0 && (
            <SectionMessage appearance="success" title={`Created ${outcome.created.length} work item${outcome.created.length === 1 ? '' : 's'}`}>
              <List type="unordered">
                {outcome.created.map((item) => (
                  <ListItem key={item.key}>
                    <Link href={item.url} openNewTab>
                      {item.key}
                    </Link>
                    {` ${item.title} - ${item.assignee ? `assigned to ${item.assignee}` : 'unassigned'}${item.note ? `. ${item.note}` : ''}`}
                  </ListItem>
                ))}
              </List>
            </SectionMessage>
          )}
          {outcome.skipped.length > 0 && (
            <SectionMessage appearance="information" title="Already raised, not duplicated">
              <List type="unordered">
                {outcome.skipped.map((item) => (
                  <ListItem key={item.key}>
                    <Link href={item.url} openNewTab>
                      {item.key}
                    </Link>
                    {` ${item.title}`}
                  </ListItem>
                ))}
              </List>
            </SectionMessage>
          )}
          {outcome.failed.length > 0 && (
            <SectionMessage appearance="error" title="Could not be created">
              <List type="unordered">
                {outcome.failed.map((item) => (
                  <ListItem key={item.requirementId}>{`${item.title}: ${item.reason}`}</ListItem>
                ))}
              </List>
            </SectionMessage>
          )}
        </Stack>
      ) : (
        <Stack space="space.150">
          <Text>
            GateReady will create one Jira work item per gap and assign it to the requirement owner. Gaps that already have an open work item
            are skipped.
          </Text>
          <List type="unordered">
            {items.map((item) => (
              <ListItem key={item.requirementId}>
                {`${item.title} - ${item.owner?.displayName ? `owner ${item.owner.displayName}` : 'no owner, will be unassigned'}${
                  gaps[item.requirementId] ? ` (already raised as ${gaps[item.requirementId].issueKey})` : ''
                }`}
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
    </ModalBody>
    <ModalFooter>
      {outcome ? (
        <Button appearance="primary" onClick={onClose}>
          Done
        </Button>
      ) : (
        <ButtonGroup>
          <Button appearance="subtle" onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={onConfirm} isLoading={busy}>
            Create work items
          </Button>
        </ButtonGroup>
      )}
    </ModalFooter>
  </Modal>
);

const App = () => {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyGates, setBusyGates] = useState([]);
  const [selected, setSelected] = useState(0);
  const [raise, setRaise] = useState(null);
  const [settingUp, setSettingUp] = useState(false);
  const [passing, setPassing] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await call('getStatus');
      setStatus(data);
      setLoadError(null);
      return data;
    } catch (error) {
      setLoadError(error.message);
      return null;
    }
  }, []);

  useEffect(() => {
    load().then((data) => {
      if (data?.plan) {
        const index = data.plan.gates.findIndex((gate) => gate.id === data.plan.currentGateId);
        setSelected(index === -1 ? 0 : index);
      }
    });
  }, [load]);

  const runChecks = async (gateIds) => {
    setActionError(null);
    setBusyGates(gateIds);
    try {
      // One gate at a time keeps each backend call short and shows progress.
      for (const gateId of gateIds) {
        const { history, ...result } = await call('runCheck', { gateId });
        setStatus((current) => ({
          ...current,
          results: { ...current.results, [gateId]: result },
          histories: { ...current.histories, [gateId]: history },
        }));
        setBusyGates((current) => current.filter((id) => id !== gateId));
      }
    } catch (error) {
      setActionError(error.message);
    }
    setBusyGates([]);
  };

  const confirmRaise = async () => {
    setRaise((current) => ({ ...current, busy: true }));
    try {
      const outcome = await call('createGapIssues', { gateId: raise.gate.id });
      await load();
      setRaise((current) => ({ ...current, busy: false, outcome }));
    } catch (error) {
      setRaise(null);
      setActionError(error.message);
    }
  };

  const confirmPass = async () => {
    setPassing((current) => ({ ...current, busy: true }));
    try {
      await call('passGate', { gateId: passing.gate.id });
      const data = await load();
      // Follow the project to its new current gate.
      const index = data?.plan ? data.plan.gates.findIndex((gate) => gate.id === data.plan.currentGateId) : -1;
      if (index !== -1) setSelected(index);
    } catch (error) {
      setActionError(error.message);
    }
    setPassing(null);
  };

  const loadApqp = async () => {
    setSettingUp(true);
    setActionError(null);
    try {
      await call('loadTemplate', { source: 'apqp' });
      const data = await load();
      if (data?.plan) setSelected(0);
    } catch (error) {
      setActionError(error.message);
    }
    setSettingUp(false);
  };

  if (loadError) {
    return (
      <Page>
        <ErrorBanner title="GateReady could not load this project" message={loadError} />
        <Inline>
          <Button onClick={load}>Try again</Button>
        </Inline>
      </Page>
    );
  }
  if (!status) return <Loading label="Loading gate readiness" />;

  const { plan, results, gaps, siteUrl, canEdit } = status;
  const histories = status.histories || {};

  if (!plan) {
    return (
      <Page>
        <ErrorBanner message={actionError} />
        <EmptyState
          header="Set up phase gates for this project"
          description={
            canEdit
              ? 'GateReady checks the evidence each gate needs, such as an approved PFMEA or a current Control Plan, by reading Jira and Confluence. Start from the APQP template and adjust it in Project settings > GateReady settings.'
              : 'A project administrator needs to set up the gate plan in Project settings > GateReady settings before readiness can be checked.'
          }
          primaryAction={
            canEdit ? (
              <Button appearance="primary" onClick={loadApqp} isLoading={settingUp}>
                Start with the APQP template
              </Button>
            ) : undefined
          }
        />
      </Page>
    );
  }

  const anyBusy = busyGates.length > 0;
  const checkable = plan.gates.filter((gate) => gate.requirements.length > 0);

  return (
    <Page>
      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050">
          <Heading as="h2">Gate readiness</Heading>
          <Text>{`Template: ${plan.templateName}`}</Text>
        </Stack>
        <Button onClick={() => runChecks(checkable.map((gate) => gate.id))} isDisabled={anyBusy || !checkable.length}>
          Check all gates
        </Button>
      </Inline>

      <ErrorBanner title="The action could not be completed" message={actionError} />
      {!plan.spaceKey && (
        <SectionMessage appearance="warning" title="No Confluence space is linked">
          <Text>Document rules cannot find evidence until a space is set in Project settings &gt; GateReady settings.</Text>
        </SectionMessage>
      )}

      <Box xcss={cardStyle}>
        <Stack space="space.150">
          {plan.gates.map((gate, index) => (
            <GateOverviewRow key={gate.id} plan={plan} gate={gate} index={index} result={results[gate.id]} busy={busyGates.includes(gate.id)} />
          ))}
        </Stack>
      </Box>

      <Tabs id="gates" selected={selected} onChange={(index) => setSelected(index)}>
        <TabList>
          {plan.gates.map((gate) => (
            <Tab key={gate.id}>{gate.name}</Tab>
          ))}
        </TabList>
        {plan.gates.map((gate) => (
          <TabPanel key={gate.id}>
            <Box paddingBlockStart="space.200" xcss={xcss({ width: '100%' })}>
              <Stack space="space.200">
                {gate.description ? <Text>{gate.description}</Text> : null}
                <GateDetail
                  gate={gate}
                  result={results[gate.id]}
                  gaps={gaps}
                  history={histories[gate.id]}
                  siteUrl={siteUrl}
                  canEdit={canEdit}
                  busy={busyGates.includes(gate.id)}
                  onRun={() => runChecks([gate.id])}
                  onPass={() => setPassing({ gate, summary: results[gate.id].summary, busy: false })}
                  onRaise={(items) => setRaise({ gate, items, busy: false, outcome: null })}
                />
              </Stack>
            </Box>
          </TabPanel>
        ))}
      </Tabs>

      <ModalTransition>
        {raise && (
          <RaiseGapsModal
            gate={raise.gate}
            items={raise.items}
            gaps={gaps}
            busy={raise.busy}
            outcome={raise.outcome}
            onConfirm={confirmRaise}
            onClose={() => setRaise(null)}
          />
        )}
        {passing && (
          <PassGateModal gate={passing.gate} summary={passing.summary} busy={passing.busy} onConfirm={confirmPass} onClose={() => setPassing(null)} />
        )}
      </ModalTransition>
    </Page>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
