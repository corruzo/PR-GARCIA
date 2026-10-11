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

test('brand colors for buttons, navigation and text meet WCAG AA contrast', () => {
  const pairs = [
    ['#FFFFFF', '#9F1239'], // botón principal vinotinto
    ['#FFFFFF', '#84102F'], // botón al pasar el cursor
    ['#9F1239', '#FFFFFF'], // texto y enlaces de marca
    ['#222222', '#FFFFFF'], // texto principal
    ['#6A6A6A', '#FFFFFF'], // texto secundario
    ['#F5F5F7', '#1C1C1E'], // texto principal modo oscuro
    ['#A1A1A6', '#1C1C1E'], // texto secundario modo oscuro
    ['#A1A1A6', '#262628'], // texto secundario en tarjetas oscuras
    ['#FB7185', '#1C1C1E'], // acento de marca en modo oscuro
    ['#FB7185', '#262628'], // acento sobre tarjetas oscuras
    ['#84102F', '#FFF1F3'], // etiqueta de marca sobre fondo rosado
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet 4.5:1 contrast`,
    );
  }
});
test('focus outlines meet the 3:1 non-text contrast minimum', () => {
  assert.ok(contrastRatio('#222222', '#FFFFFF') >= 3);
  assert.ok(contrastRatio('#F5F5F7', '#1C1C1E') >= 3);
});
