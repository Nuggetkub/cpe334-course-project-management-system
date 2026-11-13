import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function testCounts(report) {
  const keys = ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'];
  const counts = keys.map(key => report[key] ?? (key === 'numTodoTests' ? 0 : undefined));
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0)
      || counts[0] === 0 || counts.slice(1).reduce((sum, value) => sum + value, 0) !== counts[0]) {
    throw new Error('Missing, empty or inconsistent Vitest counts');
  }
  if (report.success !== true || counts[2] !== 0) {
    throw new Error('Vitest report does not record a successful test run');
  }
  return `${counts[1]} passed / ${counts[2]} failed / ${counts[3]} skipped / ${counts[4]} todo (${counts[0]} total)`;
}

export function renderSummary(outcomes, readReport) {
  const lines = ['## CI verification', '', '| Check | Outcome | Evidence |', '| --- | --- | --- |'];
  const problems = [];
  for (const [label, key, reportPath, evidence] of [
    ['Deploy tooling', 'DEPLOY_TOOLS_OUTCOME', null, 'Shell syntax, summary tests, offline deploy/release stubs and Python smoke tests'],
    ['Server', 'SERVER_OUTCOME', 'artifacts/ci/server-tests.json', 'Install, migrations, opt-in CI seed, typecheck, tests and build'],
    ['Client', 'CLIENT_OUTCOME', 'artifacts/ci/client-tests.json', 'Install, tests and production build'],
    ['Docker', 'DOCKER_OUTCOME', null, 'Unified production image build; not pushed or deployed'],
  ]) {
    const outcome = outcomes[key] || 'not run';
    let detail = evidence;
    if (reportPath && outcome === 'success') {
      try {
        detail += `; ${testCounts(readReport(reportPath))}`;
      } catch {
        detail += '; valid passing test report missing';
        problems.push(`${label}: valid passing test report missing`);
      }
    } else if (reportPath) {
      detail += '; see step logs and any uploaded JSON report (not counted as passing)';
    }
    lines.push(`| ${label} | ${outcome} | ${detail} |`);
  }
  lines.push('', 'This job has no GCP credentials and does not deploy. Skipped, failed or cancelled steps are not passing evidence.', '');
  return { markdown: lines.join('\n'), problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = renderSummary(process.env, path => JSON.parse(readFileSync(path, 'utf8')));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.markdown);
  else console.log(result.markdown);
  if (result.problems.length) {
    console.error(result.problems.join('\n'));
    process.exitCode = 1;
  }
}
