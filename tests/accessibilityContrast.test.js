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
    ['#FFFFFF', '#163E78'], // botón principal
    ['#475569', '#F3F5F8'], // texto secundario claro
    ['#CBD5E1', '#071426'], // texto secundario oscuro
    ['#163E78', '#F3F5F8'], // texto de marca
    ['#8CB0DB', '#071426'], // texto de marca en tema oscuro
    ['#FFFFFF', '#112F5C'], // pestañas de navegación
    ['#DCE7F5', '#112F5C'], // pestañas inactivas
    ['#06142A', '#C9A227'], // botón dorado
    ['#E9CF7A', '#06142A'], // dorado sobre franja superior
    ['#7F6413', '#FFFFFF'], // lema dorado del logo
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet 4.5:1 contrast`,
    );
  }
});
test('focus outlines meet the 3:1 non-text contrast minimum', () => {
  assert.ok(contrastRatio('#1F4F93', '#F3F5F8') >= 3);
  assert.ok(contrastRatio('#DDB94A', '#071426') >= 3);
});
