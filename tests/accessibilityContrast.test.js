import assert from 'node:assert/strict';
import test from 'node:test';

function linearize(channel) {
  const normalized = Number.parseInt(channel, 16) / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [red, green, blue] = hex.slice(1).match(/.{2}/g).map(linearize);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test('primary button, muted text, and focus colors meet WCAG AA contrast', () => {
  const pairs = [
    ['#FFFFFF', '#047857'],
    ['#475569', '#F8FAFC'],
    ['#CBD5E1', '#0F172A'],
    ['#047857', '#F8FAFC'],
    ['#6EE7B7', '#0F172A'],
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet 4.5:1 contrast`,
    );
  }
});