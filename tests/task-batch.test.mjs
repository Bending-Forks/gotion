import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../.claude/skills/task-batch/scripts/task-batch.sh', import.meta.url).pathname;
const tracker = '30cf720c-4b16-8292-af30-07ac9991dc17';
const jq = spawnSync('sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();

// A folder with a bin/ of fake commands. PATH holds only bin/ and the system folders, so the claude, codex, agy and
// ntn of the developer's machine never run.
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'task-batch-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  symlinkSync(jq, join(bin, 'jq'));
  return {
    dir,
    file(name, content) {
      const path = join(dir, name);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
      return path;
    },
    fake(name, body) {
      writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    },
    run(args, env = {}) {
      return spawnSync('bash', [script, ...args], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, NOTION_API_TOKEN: 'token', NOTION_USER_ID: 'ME', ...env },
      });
    },
  };
}

// A row of the Tasks Tracker as the Notion API returns it.
function row({ id, title, status = 'Not started', vibe = true, assignees = [], blockedBy = [], due = null, priority = null,
  effort = null, target = null }) {
  return {
    object: 'page', id, url: `https://www.notion.so/${id}`,
    properties: {
      'Task name': { type: 'title', title: [{ plain_text: title }] },
      Status: { type: 'status', status: { name: status } },
      Vibecodabile: { type: 'checkbox', checkbox: vibe },
      Assignee: { type: 'people', people: assignees.map((a) => ({ object: 'user', id: a })) },
      'Blocked by': { type: 'relation', relation: blockedBy.map((b) => ({ id: b })), has_more: false },
      'Due date': { type: 'date', date: due && { start: due, end: null } },
      Priority: { type: 'select', select: priority && { name: priority } },
      Effort: { type: 'number', number: effort },
      Target: { type: 'select', select: target && { name: target } },
    },
  };
}

const page = (results, next = null) => ({ object: 'list', results, has_more: next !== null, next_cursor: next });

// ntn that answers the query of the tracker with page1.json, then page2.json after the cursor CUR
function fakeNtn(s) {
  s.fake('ntn', `[[ -n $NOTION_API_TOKEN && "$1 $2 $3" == "datasources query ${tracker}" ]] || exit 1
if [[ " $* " == *" --start-cursor CUR "* ]]; then cat ${s.dir}/page2.json; else cat ${s.dir}/page1.json; fi`);
}

test('config refuses to start without the Notion token or the Notion user', () => {
  const s = sandbox();
  let r = s.run(['config'], { NOTION_API_TOKEN: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NOTION_API_TOKEN/);
  r = s.run(['config'], { NOTION_USER_ID: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NOTION_USER_ID/);
  assert.equal(s.run(['config']).status, 0);
});

test('tracker keeps the Not started Vibecodabile tasks that are free or mine, in timeline order, with their open blockers', () => {
  const s = sandbox();
  s.file('page1.json', page([
    row({ id: 'a', title: 'A', status: 'Done' }),
    row({ id: 'b', title: 'B', assignees: ['ME'], blockedBy: ['a'], due: '2026-11-20', priority: 'Low' }),
    row({ id: 'c', title: 'C', blockedBy: ['b'], due: '2026-11-19', priority: 'High', effort: 3, target: 'X' }),
    row({ id: 'd', title: 'D', assignees: ['OTHER'] }),
  ], 'CUR'));
  s.file('page2.json', page([
    row({ id: 'e', title: 'E', vibe: false }),
    row({ id: 'f', title: 'F', due: '2026-11-19', priority: 'Low' }),
    row({ id: 'g', title: 'G', status: 'In progress', assignees: ['OTHER'] }),
    row({ id: 'h', title: 'H' }),
  ]));
  fakeNtn(s);
  const r = s.run(['tracker', s.dir]);
  assert.equal(r.status, 0, r.stderr);
  const candidates = JSON.parse(readFileSync(join(s.dir, 'candidates.json'), 'utf8'));
  assert.deepEqual(candidates.map((c) => [c.id, c.eligible, c.open_blockers]),
    [['c', false, ['B']], ['f', true, []], ['b', true, []], ['h', true, []]]);
  assert.deepEqual([candidates[0].estimate, candidates[0].target], [3, 'X']);
  assert.deepEqual(JSON.parse(readFileSync(join(s.dir, 'in-progress.json'), 'utf8')),
    [{ id: 'g', title: 'G', assignees: ['OTHER'] }]);
});

test('tracker exits 1 and names the open blockers when no task is eligible', () => {
  const s = sandbox();
  s.file('page1.json', page([
    row({ id: 'a', title: 'Skeleton', status: 'In progress' }),
    row({ id: 'b', title: 'B', blockedBy: ['a'] }),
  ]));
  fakeNtn(s);
  const r = s.run(['tracker', s.dir]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Skeleton/);
});

test('tracker exits 2 when ntn fails', () => {
  const s = sandbox();
  s.fake('ntn', 'exit 1');
  assert.equal(s.run(['tracker', s.dir]).status, 2);
});

test('batch keeps the longest prefix with the Target of the first task, within the points and the number of tasks', () => {
  const s = sandbox();
  s.file('candidates.json', [
    { id: 'a', target: 'X', estimate: 3 }, { id: 'b', target: 'X', estimate: 3 }, { id: 'c', target: 'X', estimate: null },
    { id: 'd', target: 'Y', estimate: 1 }, { id: 'f', target: 'X', estimate: 3 },
  ]);
  const batch = (ids, env) => JSON.parse(s.run(['batch', s.dir, ...ids], env).stdout);
  const eight = { BATCH_POINTS: '8', MAX_TASKS: '3' };
  assert.deepEqual(batch(['a', 'b', 'f', 'c'], eight), { tasks: ['a', 'b'], points: 6 });
  assert.deepEqual(batch(['a', 'd', 'b'], eight), { tasks: ['a'], points: 3 });
  assert.deepEqual(batch(['c', 'a'], eight), { tasks: ['c'], points: null });
  assert.deepEqual(batch(['a', 'b', 'f'], { BATCH_POINTS: '20', MAX_TASKS: '2' }), { tasks: ['a', 'b'], points: 6 });
});

test('batch rejects an id that is not a candidate', () => {
  const s = sandbox();
  s.file('candidates.json', [{ id: 'a', target: 'X', estimate: 3 }]);
  const r = s.run(['batch', s.dir, 'a', 'zzz']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /zzz/);
});

// claude whose probe with Haiku reports the usage, as the stream-json of claude -p does
function fakeClaude(s) {
  s.fake('claude', `[[ " $* " == *" -p "* && " $* " == *" --model haiku "* ]] || exit 1
touch ${s.dir}/claude-called
cat <<'EOF'
{"type":"system","subtype":"init","session_id":"s"}
{"type":"rate_limit_event","rate_limit_info":{"unifiedWindows":{"five_hour":{"utilization":0.38,"resetsAt":1795723059,"status":"allowed"},"seven_day":{"utilization":0.61,"resetsAt":1796048894,"status":"allowed"}}}}
{"type":"result","subtype":"success","is_error":false,"result":"ok","session_id":"s"}
EOF`);
}

const levels = (...efforts) => efforts.map((effort) => ({ effort, description: effort }));
function fakeCodex(s, { loggedIn = true, session = true } = {}) {
  s.fake('codex', `[[ "$1 $2" == "login status" ]] && exit ${loggedIn ? 0 : 1}
exit 1`);
  s.file('.codex/models_cache.json', {
    fetched_at: '2026-11-26T10:00:00Z',
    models: [
      { slug: 'gpt-6.1-terra', display_name: 'GPT-6.1-Terra', supported_reasoning_levels: levels('low', 'high') },
      { slug: 'gpt-6.2-astra', display_name: 'GPT-6.2-Astra', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max', 'ultra') },
      { slug: 'gpt-6.2-sol', display_name: 'GPT-6.2-Sol', supported_reasoning_levels: levels('low', 'medium', 'high', 'xhigh', 'max', 'ultra') },
    ],
  });
  if (!session) return;
  const tokenCount = (timestamp, primary, secondary) => JSON.stringify({ timestamp, type: 'event_msg', payload: {
    type: 'token_count', info: null, rate_limits: { limit_id: 'codex', limit_name: null,
      primary: { used_percent: primary, window_minutes: 300, resets_at: 1795723059 },
      secondary: { used_percent: secondary, window_minutes: 10080, resets_at: 1796048894 },
      credits: { has_credits: false, unlimited: false, balance: '0' }, plan_type: 'plus', rate_limit_reached_type: null } } });
  const older = s.file('.codex/sessions/2026/11/24/rollout-0.jsonl', tokenCount('2026-11-24T09:00:00.000Z', 90.0, 70.0) + '\n');
  const twoDaysAgo = new Date(Date.now() - 2 * 86400e3);
  utimesSync(older, twoDaysAgo, twoDaysAgo);
  s.file('.codex/sessions/2026/11/26/rollout-1.jsonl', [
    JSON.stringify({ timestamp: '2026-11-26T16:20:00.000Z', type: 'session_meta', payload: {} }),
    tokenCount('2026-11-26T16:21:00.000Z', 40.0, 20.0),
    tokenCount('2026-11-26T16:23:32.656Z', 46.0, 24.0),
  ].join('\n') + '\n');
}

const claudeModels = ['opus', 'Opus 5.5', 'sonnet', 'Sonnet 5.5'];
const allClaudeEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
const allCodexEfforts = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

test('reviewers lists the agents that are logged in, with their models, efforts and usage', () => {
  const s = sandbox();
  fakeClaude(s);
  fakeCodex(s);
  const r = s.run(['reviewers']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [
    {
      provider: 'claude',
      usage: { five_hour: 38, seven_day: 61, resets_at: 1795723059, status: 'allowed', as_of: null },
      models: [
        { id: claudeModels[0], name: claudeModels[1], efforts: allClaudeEfforts },
        { id: claudeModels[2], name: claudeModels[3], efforts: allClaudeEfforts },
      ],
      suggested: { model: 'opus', effort: 'xhigh' },
    },
    {
      provider: 'codex',
      usage: { five_hour: 46, seven_day: 24, resets_at: 1795723059, status: null, as_of: '2026-11-26T16:23:32.656Z' },
      models: [
        { id: 'gpt-6.2-sol', name: 'GPT-6.2-Sol', efforts: allCodexEfforts },
        { id: 'gpt-6.2-astra', name: 'GPT-6.2-Astra', efforts: allCodexEfforts },
      ],
      suggested: { model: 'gpt-6.2-sol', effort: 'high' },
    },
  ]);
});

test('reviewers leaves out an agent that is not logged in, and gives no usage when Codex recorded none', () => {
  const s = sandbox();
  s.fake('claude', 'echo "Not logged in" >&2; exit 1');
  fakeCodex(s, { session: false });
  const r = s.run(['reviewers']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).map((a) => [a.provider, a.usage]), [['codex', null]]);
  fakeCodex(s, { loggedIn: false });
  assert.deepEqual(JSON.parse(s.run(['reviewers']).stdout), []);
});

test('reviewers reads the models of agy and puts their efforts in order', () => {
  const s = sandbox();
  s.fake('agy', `[[ $1 == models ]] || exit 1
echo "Fetching available models..."
printf '%s\\t%s\\n' gemini-4-neon-high 'Gemini 4 Neon (High)' gemini-4-neon-xhigh 'Gemini 4 Neon (XHigh)' \\
  gemini-4-neon-low 'Gemini 4 Neon (Low)' gemini-4-carbon-medium 'Gemini 4 Carbon (Medium)' \\
  gemini-4-neon-medium 'Gemini 4 Neon (Medium)' gemini-4-carbon-low 'Gemini 4 Carbon (Low)' \\
  gemini-4-carbon-high 'Gemini 4 Carbon (High)' gemini-3.8-flash-low 'Gemini 3.8 Flash (Low)'`);
  const r = s.run(['reviewers']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [{
    provider: 'agy',
    usage: null,
    models: [
      { id: 'gemini-4-neon', name: 'Gemini 4 Neon', efforts: ['low', 'medium', 'high', 'xhigh'] },
      { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', efforts: ['low', 'medium', 'high'] },
    ],
    suggested: { model: 'gemini-4-neon', effort: 'high' },
  }]);
});

test('reviewers with an agent asks only that agent, so no probe of Claude spends usage', () => {
  const s = sandbox();
  fakeClaude(s);
  fakeCodex(s);
  assert.deepEqual(JSON.parse(s.run(['reviewers', 'codex']).stdout).map((a) => a.provider), ['codex']);
  assert.equal(existsSync(join(s.dir, 'claude-called')), false);
});

test('check-reviewer accepts a model and effort that the agent has, and says what is wrong otherwise', () => {
  const s = sandbox();
  fakeCodex(s);
  assert.equal(s.run(['check-reviewer', 'codex', 'gpt-6.2-sol', 'ultra']).status, 0);
  let r = s.run(['check-reviewer', 'codex', 'gpt-6.2-sol', 'minimal']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /minimal/);
  assert.match(r.stderr, /xhigh/);
  r = s.run(['check-reviewer', 'codex', 'gpt-9', 'high']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /gpt-9/);
  assert.match(r.stderr, /gpt-6\.2-astra/);
  r = s.run(['check-reviewer', 'agy', 'gemini-4-neon', 'high']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /agy/);
});

// A worktree with the reviewer agent, and the prompt of a round
function reviewRound(s) {
  const wt = join(s.dir, 'wt');
  s.file('wt/.claude/agents/reviewer.md', '---\nname: reviewer\nmodel: opus\n---\n\nREVIEWER RULES\n');
  return { wt, prompt: s.file('prompt.md', 'ROUND 1 OF 3'), out: join(s.dir, 'out') };
}

test('review runs Codex read-only with the schema, and review-wait gives back its verdict', () => {
  const s = sandbox();
  const { wt, prompt, out } = reviewRound(s);
  s.fake('codex', `printf '%s\\n' "$@" > ${s.dir}/args; cat > ${s.dir}/stdin
while [[ $# -gt 0 ]]; do [[ $1 == -o ]] && o=$2; shift; done
echo '{"clean":false,"issues":["a.go:1 wrong"]}' > "$o"`);
  assert.equal(s.run(['review', 'codex', 'gpt-6.2-sol', 'high', wt, prompt, out]).status, 0);
  const r = s.run(['review-wait', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { clean: false, issues: ['a.go:1 wrong'] });
  const args = readFileSync(join(s.dir, 'args'), 'utf8').split('\n');
  assert.equal(args[0], 'exec');
  for (const [flag, value] of [['-C', wt], ['-s', 'read-only'], ['-m', 'gpt-6.2-sol'], ['-c', 'model_reasoning_effort="high"']]) {
    assert.equal(args[args.indexOf(flag) + 1], value, flag);
  }
  assert.match(readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8'), /"clean"/);
  const stdin = readFileSync(join(s.dir, 'stdin'), 'utf8');
  assert.match(stdin, /REVIEWER RULES[\s\S]*ROUND 1 OF 3/);
  assert.doesNotMatch(stdin, /name: reviewer/);
});

test('review runs agy in plan mode and Claude with the reviewer agent, and takes their structured output', () => {
  const s = sandbox();
  const { wt, prompt, out } = reviewRound(s);
  s.fake('agy', `printf '%s\\n' "$@" > ${s.dir}/agy-args
echo '{"conversation_id":"c","status":"SUCCESS","response":"{}","structured_output":{"clean":true,"issues":[]}}'`);
  s.fake('claude', `printf '%s\\n' "$@" > ${s.dir}/claude-args; cat > ${s.dir}/claude-stdin
echo '{"type":"result","subtype":"success","is_error":false,"result":"{}","structured_output":{"clean":false,"issues":["x"]}}'`);
  s.run(['review', 'agy', 'gemini-4-neon', 'xhigh', wt, prompt, out]);
  assert.deepEqual(JSON.parse(s.run(['review-wait', out]).stdout), { clean: true, issues: [] });
  const agy = readFileSync(join(s.dir, 'agy-args'), 'utf8');
  assert.match(agy, /--model\ngemini-4-neon-xhigh\n/);
  assert.match(agy, /--mode\nplan\n/);
  assert.match(agy, /--json-schema\n/);
  assert.match(agy, /REVIEWER RULES[\s\S]*ROUND 1 OF 3/);

  s.run(['review', 'claude', 'sonnet', 'max', wt, prompt, out]);
  assert.deepEqual(JSON.parse(s.run(['review-wait', out]).stdout), { clean: false, issues: ['x'] });
  const claude = readFileSync(join(s.dir, 'claude-args'), 'utf8');
  assert.match(claude, /--agent\nreviewer\n/);
  assert.match(claude, /--model\nsonnet\n/);
  assert.match(claude, /--effort\nmax\n/);
  assert.match(claude, /--json-schema\n/);
  assert.equal(readFileSync(join(s.dir, 'claude-stdin'), 'utf8'), 'ROUND 1 OF 3');
});

test('review-wait says running while the reviewer works, and fails with its error when the reviewer fails', () => {
  const s = sandbox();
  const { wt, prompt, out } = reviewRound(s);
  s.fake('codex', 'sleep 5');
  s.run(['review', 'codex', 'gpt-6.2-sol', 'high', wt, prompt, out]);
  let r = s.run(['review-wait', out], { REVIEW_WAIT: '1' });
  assert.equal(r.status, 3);
  assert.equal(r.stdout.trim(), 'running');
  s.fake('codex', 'echo boom >&2; exit 1');
  s.run(['review', 'codex', 'gpt-6.2-sol', 'high', wt, prompt, out]);
  r = s.run(['review-wait', out]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /boom/);
});
