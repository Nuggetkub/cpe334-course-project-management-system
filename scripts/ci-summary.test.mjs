import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSummary, testCounts } from './ci-summary.mjs';

const passing = { success: true, numTotalTests: 5, numPassedTests: 4, numFailedTests: 0, numPendingTests: 1, numTodoTests: 0 };

test('uses actual Vitest counts including skips', () => {
  assert.equal(testCounts(passing), '4 passed / 0 failed / 1 skipped / 0 todo (5 total)');
});

test('rejects failed, empty, missing and inconsistent reports', () => {
  for (const report of [{}, { ...passing, success: false }, { ...passing, numPassedTests: 3 },
    { ...passing, numFailedTests: 1, numPendingTests: 0 },
    { ...passing, numTotalTests: 0, numPassedTests: 0, numPendingTests: 0 }]) {
    assert.throws(() => testCounts(report));
  }
});

test('successful test steps require readable passing reports', () => {
  const result = renderSummary({ SERVER_OUTCOME: 'success', CLIENT_OUTCOME: 'success' }, () => passing);
  assert.deepEqual(result.problems, []);
  assert.match(result.markdown, /4 passed/);
  const missing = renderSummary({ SERVER_OUTCOME: 'success' }, () => { throw new Error('ENOENT'); });
  assert.deepEqual(missing.problems, ['Server: valid passing test report missing']);
});

test('failure and skipped steps cannot be reported as passing', () => {
  const result = renderSummary({ SERVER_OUTCOME: 'failure', CLIENT_OUTCOME: 'skipped', DOCKER_OUTCOME: 'cancelled' }, () => {
    throw new Error('Must not read a report for an unsuccessful step');
  });
  assert.deepEqual(result.problems, []);
  assert.match(result.markdown, /Server \| failure/);
  assert.match(result.markdown, /Client \| skipped/);
  assert.match(result.markdown, /Docker \| cancelled/);
  assert.doesNotMatch(result.markdown, /4 passed/);
});
