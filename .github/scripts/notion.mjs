// Keeps the Pull Requests database on Notion in step with GitHub, for the notion.yml workflow:
// - on every pull_request event the page of the pull request gets its title, state, author, branch, labels and dates,
//   and its Tasks relation becomes the tasks of the Tasks Tracker that the description links to;
// - when a pull request is merged, each of its tasks moves to Done once none of the task's pull requests is still open.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TRACKER = '30cf720c-4b16-8292-af30-07ac9991dc17'; // data source of the Tasks Tracker
const PULLS = '41df720c-4b16-8170-9dac-000beab87160'; // data source of the Pull Requests

// The page ID is the last 32 hex digits of the path of a Notion link, once the dashes are gone
export function taskIds(body) {
  const ids = (body ?? '').match(/https:\/\/[a-z.]*notion\.(?:so|com)\/[^\]\s)>"]+/g) ?? [];
  return [...new Set(ids.map((url) => url.replace(/[?#].*/, '').replaceAll('-', '').match(/[0-9a-f]{32}$/)?.[0]).filter(Boolean))];
}

export function state(pr) {
  if (pr.merged_at) return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  return pr.draft ? 'Draft' : 'Open';
}

// The Conventional Commits type of the title, after a prefix in brackets such as the "[interrotto]" of the nightly job
export const type = (title) => title.match(/^(?:\[[^\]]*\]\s*)?([a-z]+)(?:\([^)]*\))?!?:/)?.[1] ?? null;

export function properties(pr, tasks) {
  return {
    Title: { title: [{ text: { content: `#${pr.number} ${pr.title}` } }] },
    Number: { number: pr.number },
    Type: { select: type(pr.title) && { name: type(pr.title) } },
    Link: { url: pr.html_url },
    State: { status: { name: state(pr) } },
    Author: { select: { name: pr.user.login } },
    Branch: { rich_text: [{ text: { content: pr.head.ref } }] },
    Opened: { date: { start: pr.created_at } },
    Merged: { date: pr.merged_at ? { start: pr.merged_at } : null },
    Tasks: { relation: tasks.map((id) => ({ id })) },
    Labels: { multi_select: pr.labels.map(({ name }) => ({ name })) },
  };
}

async function call(url, token, method = 'GET', body) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (url.includes('notion.com')) headers['Notion-Version'] = '2026-03-11';
  const res = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

const notion = (path, method, body) => call(`https://api.notion.com/v1/${path}`, process.env.NOTION_API_TOKEN, method, body);
const sameId = (a, b) => a?.replaceAll('-', '') === b.replaceAll('-', '');

async function sync(pr) {
  // Only pages of the Tasks Tracker can go into the relation: a link to any other Notion page is left out
  const tasks = [];
  for (const id of taskIds(pr.body)) {
    const page = await notion(`pages/${id}`).catch(() => null);
    if (sameId(page?.parent?.data_source_id, TRACKER)) tasks.push(page.id);
    else console.log(`::warning::#${pr.number} links ${id}, which is not a task of the Tasks Tracker the integration can read`);
  }
  const query = (filter) => notion(`data_sources/${PULLS}/query`, 'POST', { filter }).then((r) => r.results);
  const [existing] = await query({ property: 'Number', number: { equals: pr.number } });
  const page = existing
    ? await notion(`pages/${existing.id}`, 'PATCH', { properties: properties(pr, tasks) })
    : await notion('pages', 'POST', { parent: { data_source_id: PULLS }, properties: properties(pr, tasks) });
  console.log(`#${pr.number} ${state(pr)}, tasks: ${tasks.join(' ') || 'none'}`);
  if (state(pr) !== 'Merged') return;
  for (const task of tasks) {
    const open = await query({ and: [
      { property: 'Tasks', relation: { contains: task } },
      { property: 'State', status: { does_not_equal: 'Merged' } },
      { property: 'State', status: { does_not_equal: 'Closed' } },
    ] });
    // The query may not see yet the state just written, so this pull request never counts as open
    const others = open.filter((p) => p.id !== page.id).map((p) => p.url);
    if (others.length) console.log(`task ${task} stays: still open ${others.join(' ')}`);
    else await notion(`pages/${task}`, 'PATCH', { properties: { Status: { status: { name: 'Done' } } } }).then(() => console.log(`task ${task} Done`));
  }
}

async function main() {
  const { NOTION_API_TOKEN, GH_TOKEN, GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;
  if (!NOTION_API_TOKEN) return console.log('::notice::NOTION_API_TOKEN is not set: nothing to do');
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const { pull_request } = JSON.parse(await readFile(GITHUB_EVENT_PATH, 'utf8'));
    // The labeler step of notion.yml has just changed the labels, so those in the event are out of date
    const labels = await call(`${pull_request.issue_url}/labels?per_page=100`, GH_TOKEN);
    return sync({ ...pull_request, labels });
  }
  // scripts/ff-merge.sh moves main onto the head of the pull request, so the pushed commit is that head. GitHub may not
  // have marked the pull request merged yet, so the push itself says it is.
  const prs = await call(`https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls`, GH_TOKEN);
  for (const pr of prs.filter((p) => p.head.sha === GITHUB_SHA)) await sync({ ...pr, merged_at: pr.merged_at ?? new Date().toISOString() });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
