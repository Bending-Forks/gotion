import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightGherkin } from '../assets/gherkin.mjs';

test('bolds step keywords and underlines whole glossary terms and plurals', () => {
  const source = '  Given a Viewer opens her main workspace\n' +
    '  When she reads pages and members\n' +
    '  Then the sub-pages remain unchanged\n' +
    '  And the page blocks stay ordered\n';
  const result = highlightGherkin(source, ['Workspace', 'Main workspace', 'Viewer', 'Page', 'Sub-page', 'Page block', 'Member']);
  for (const keyword of ['Given', 'When', 'Then', 'And']) {
    assert.ok(result.includes(`<strong>  ${keyword}</strong>`));
  }
  for (const term of ['Viewer', 'main workspace', 'pages', 'members', 'sub-pages', 'page blocks']) {
    assert.ok(result.includes(`<u>${term}</u>`));
  }
  assert.equal(result.replace(/<\/?(?:strong|u)>/g, ''), source);
});

test('preserves placeholders, escapes HTML and leaves partial words alone', () => {
  const result = highlightGherkin('Given <role> & <script>pages</script> Then pageless\n', ['Page']);
  assert.equal(result, '<strong>Given</strong> &lt;role&gt; &amp; &lt;script&gt;<u>pages</u>&lt;/script&gt; Then pageless\n');
  assert.equal(highlightGherkin('Then nothing changes', []), '<strong>Then</strong> nothing changes');
});

test('bolds every English Gherkin keyword and alias in its DSL position', () => {
  const headings = ['Feature', 'Business Need', 'Ability', 'Rule', 'Background',
    'Scenario', 'Example', 'Scenario Outline', 'Scenario Template', 'Examples', 'Scenarios'];
  for (const keyword of headings) {
    assert.equal(highlightGherkin(`  ${keyword}: A title`, []), `<strong>  ${keyword}</strong>: A title`);
  }
  for (const keyword of ['Given', 'When', 'Then', 'And', 'But', '*']) {
    assert.equal(highlightGherkin(`    ${keyword} a step`, []), `<strong>    ${keyword}</strong> a step`);
  }
  assert.equal(highlightGherkin('  Scenario Outline without a colon', []), '  Scenario Outline without a colon');
});
