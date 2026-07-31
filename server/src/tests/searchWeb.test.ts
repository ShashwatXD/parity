import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWebResults, parseDuckDuckGoHtml } from '../agent/searchWeb.js';

test('parseDuckDuckGoHtml extracts titles, snippets, and unwraps uddg links', () => {
  const html = `
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.xe.com%2Fcurrencyconverter%2F">USD to INR</a>
    <a class="result__snippet">1 USD = 83.5 INR as of today</a>
    <a class="result__a" href="https://www.google.com/finance/quote/USD-INR">Google Finance USD INR</a>
    <a class="result__snippet">Live currency conversion</a>
  `;
  const hits = parseDuckDuckGoHtml(html, 5);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].title, 'USD to INR');
  assert.match(hits[0].url, /xe\.com/);
  assert.match(hits[0].snippet, /83\.5/);
  assert.equal(hits[1].url, 'https://www.google.com/finance/quote/USD-INR');
});

test('formatWebResults renders numbered list', () => {
  const text = formatWebResults('USD INR', 'Tavily', [
    { title: 'Rate', snippet: '83.2', url: 'https://example.com' },
  ]);
  assert.match(text, /via Tavily/);
  assert.match(text, /1\. Rate/);
  assert.match(text, /83\.2/);
  assert.match(text, /example\.com/);
});

test('formatWebResults handles empty hits', () => {
  assert.match(formatWebResults('q', 'DuckDuckGo', []), /No web results/);
});
