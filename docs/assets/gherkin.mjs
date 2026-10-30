export function highlightGherkin(source, terms) {
  const vocabulary = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    '(^[\\t ]*(?:(?:Feature|Business Need|Ability|Rule|Background|Scenario(?: Outline| Template)?|Examples?|Scenarios)(?=:)' +
    '|(?:Given|When|Then|And|But)\\b|\\*(?=[\\t ])))' +
    (vocabulary.length ? '|\\b(?:' + vocabulary.join('|') + ')s?\\b' : ''),
    'gim'
  );
  return source
    .replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])
    .replace(pattern, (text, keyword) => keyword ? `<strong>${text}</strong>` : `<u>${text}</u>`);
}
