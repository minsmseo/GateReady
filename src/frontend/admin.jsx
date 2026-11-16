import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, Heading, Inline, List, ListItem, Lozenge, SectionMessage, Stack, Text, xcss } from '@forge/react';
import { call, ErrorBanner, Loading, Page } from './shared';

/**
 * Jira admin page: loads the fictional demo scenario so the product can be
 * tried end to end on an empty site.
 */

const cardStyle = xcss({
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
});

const noShrinkStyle = xcss({ flexShrink: '0' });

const STEP_LABEL = {
  jira: 'Jira project and work items',
  confluence: 'Confluence space and documents',
  plan: 'Gate plan (APQP template)',
};

const Part = ({ done, label }) => (
  <Inline space="space.100" alignBlock="center" spread="space-between">
    <Text>{label}</Text>
    <Box xcss={noShrinkStyle}>
      <Lozenge appearance={done ? 'success' : 'default'}>{done ? 'Ready' : 'Missing'}</Lozenge>
    </Box>
  </Inline>
);

const App = () => {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);

  const load = useCallback(async () => {
    try {
      setState(await call('getSeedStatus'));
      setError(null);
    } catch (failure) {
      setError(failure.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async () => {
    setRunning(true);
    setError(null);
    setLog([]);
    try {
      for (const project of state.projects) {
        for (const step of state.steps) {
          setLog((lines) => [...lines, { key: `${project.key}-${step}`, text: `${project.name}: creating ${STEP_LABEL[step].toLowerCase()}...`, done: false }]);
          const { message } = await call('runSeedStep', { projectKey: project.key, step });
          setLog((lines) => lines.map((line) => (line.key === `${project.key}-${step}` ? { ...line, text: message, done: true } : line)));
        }
      }
    } catch (failure) {
      setError(failure.message);
    }
    await load();
    setRunning(false);
  };

  if (!state && !error) return <Loading label="Checking demo data" />;

  const complete = state?.projects.every((project) => project.jira && project.confluence && project.plan);

  return (
    <Page>
      <Stack space="space.100">
        <Text>
          Creates two fictional automotive supplier projects with Jira work items, Confluence documents and an APQP gate plan. Both projects
          use the same template and are at the same gate, but their evidence differs, so their readiness differs. All company names, parts
          and numbers are invented.
        </Text>
      </Stack>

      <ErrorBanner title="Demo data could not be created" message={error} />

      {state && (
        <>
          <Inline space="space.200" alignBlock="stretch">
            {state.projects.map((project) => (
              <Box key={project.key} xcss={cardStyle}>
                <Stack space="space.100">
                  <Heading as="h3">{`${project.name} (${project.key})`}</Heading>
                  <Text>{project.description}</Text>
                  <Part done={project.jira} label={STEP_LABEL.jira} />
                  <Part done={project.confluence} label={STEP_LABEL.confluence} />
                  <Part done={project.plan} label={STEP_LABEL.plan} />
                </Stack>
              </Box>
            ))}
          </Inline>

          {complete && !running && (
            <SectionMessage appearance="success" title="Demo data is ready">
              <Text>
                Open the Brake Sensor Housing or EV Battery Bracket project in Jira and choose GateReady in the project navigation, then run a
                check.
              </Text>
            </SectionMessage>
          )}

          <Inline>
            <Button appearance="primary" onClick={run} isLoading={running}>
              {complete ? 'Reset demo scenario' : 'Create demo data'}
            </Button>
          </Inline>

          {log.length > 0 && (
            <List type="unordered">
              {log.map((line) => (
                <ListItem key={line.key}>{line.done ? line.text : `${line.text}`}</ListItem>
              ))}
            </List>
          )}
          <Text size="small">
            This takes about a minute. Existing projects, spaces, pages and work items are never overwritten; only missing ones are
            added. The gate plans and check results of the two demo projects (BSH, EVB) are reset to the demo scenario each time. To
            start over completely, delete the BSH and EVB projects in Jira and the BSH and EVB spaces in Confluence.
          </Text>
        </>
      )}
    </Page>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
