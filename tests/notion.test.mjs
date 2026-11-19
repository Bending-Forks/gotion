import assert from 'node:assert/strict';
import { test } from 'node:test';
import { properties, state, taskIds, type } from '../.github/scripts/notion.mjs';

const id = '41bf720c4b16817aac38e36d2d0cecf0';

test('takes the page ID of every Notion link once, whatever the form of the link', () => {
  const body = `Tasks:
- [Account](https://app.notion.com/p/Account-contracts-${id}?pvs=4)
- https://www.notion.so/41bf720c-4b16-817e-903b-f9ed11c2f7fa#heading
- <https://notion.so/workspace/${id}>
- (https://www.notion.com/41bf720c4b1681d38956c77dbca9dca6)
Not Notion: https://github.com/x/y/pull/1, https://example.com/${id}`;
  assert.deepEqual(taskIds(body), [id, '41bf720c4b16817e903bf9ed11c2f7fa', '41bf720c4b1681d38956c77dbca9dca6']);
  assert.deepEqual(taskIds(null), []);
});

test('maps a pull request to its state, merged first', () => {
  assert.equal(state({ state: 'open', draft: true }), 'Draft');
  assert.equal(state({ state: 'open', draft: false }), 'Open');
  assert.equal(state({ state: 'closed', draft: true }), 'Closed');
  assert.equal(state({ state: 'open', draft: true, merged_at: '2026-11-19T10:00:00Z' }), 'Merged');
});

test('takes the Conventional Commits type of the title, with or without scope, breaking mark or prefix', () => {
  assert.equal(type('feat: event envelope'), 'feat');
  assert.equal(type('feat(web)!: React client'), 'feat');
  assert.equal(type('[interrotto] docs: the ADRs'), 'docs');
  assert.equal(type('chore(deps): update node to v24'), 'chore');
  assert.equal(type('Update the README'), null);
});

test('builds the properties of the page, with no merge date until the merge', () => {
  const pr = { number: 7, title: 'feat: "quoted"', html_url: 'https://github.com/x/y/pull/7', state: 'open', draft: false,
    user: { login: 'someone' }, head: { ref: 'feat/x' }, created_at: '2026-11-19T09:00:00Z', merged_at: null };
  const p = properties(pr, [id]);
  assert.equal(p.Title.title[0].text.content, '#7 feat: "quoted"');
  assert.equal(p.State.status.name, 'Open');
  assert.equal(p.Type.select.name, 'feat');
  assert.equal(properties({ ...pr, title: 'no type' }, []).Type.select, null);
  assert.equal(p.Merged.date, null);
  assert.deepEqual(p.Tasks.relation, [{ id }]);
});
