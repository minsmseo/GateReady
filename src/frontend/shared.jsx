import React from 'react';
import { Inline, Lozenge, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { VERDICT_LABEL } from '../domain/ruleTypes.js';

/**
 * Calls a backend resolver. Resolvers answer { ok, data } or { ok, error };
 * this turns the error case into a thrown Error with a readable message.
 */
export const call = async (name, payload = {}) => {
  let response;
  try {
    response = await invoke(name, payload);
  } catch (error) {
    throw new Error('GateReady could not reach its backend. Check your connection and try again.');
  }
  if (!response?.ok) {
    const failure = new Error(response?.error?.message || 'Something went wrong. Try again in a moment.');
    failure.code = response?.error?.code;
    throw failure;
  }
  return response.data;
};

const VERDICT_APPEARANCE = { met: 'success', not_met: 'removed', needs_review: 'moved' };

export const VerdictLozenge = ({ verdict }) => (
  <Lozenge appearance={VERDICT_APPEARANCE[verdict] || 'default'} isBold>
    {VERDICT_LABEL[verdict] || 'Not checked'}
  </Lozenge>
);

export const Loading = ({ label }) => (
  <Inline space="space.100" alignBlock="center">
    <Spinner size="medium" label={label} />
    <Text>{label}</Text>
  </Inline>
);

export const ErrorBanner = ({ title = 'Something went wrong', message }) =>
  message ? (
    <SectionMessage appearance="error" title={title}>
      <Text>{message}</Text>
    </SectionMessage>
  ) : null;

export const formatDateTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export const formatDate = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { dateStyle: 'medium' });
};

export const Page = ({ children }) => <Stack space="space.300">{children}</Stack>;
