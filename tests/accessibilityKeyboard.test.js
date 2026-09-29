import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRadioKeyDown, handleTabKeyDown } from '../src/utils/keyboardTabs.js';

function createKeyEvent(key, role, items, currentIndex) {
  let prevented = false;
  const currentTarget = items[currentIndex];
  currentTarget.closest = () => ({ querySelectorAll: () => items });
  const event = {
    key,
    currentTarget,
    preventDefault: () => { prevented = true; },
  };

  return { event, wasPrevented: () => prevented };
}

function createItems(count) {
  return Array.from({ length: count }, () => ({ focused: false, clicked: false,
    focus() { this.focused = true; },
    click() { this.clicked = true; },
  }));
}

test('tabs move focus, activate, and wrap with arrow keys', () => {
  const tabs = createItems(2);
  const { event, wasPrevented } = createKeyEvent('ArrowRight', 'tab', tabs, 1);

  handleTabKeyDown(event);

  assert.equal(wasPrevented(), true);
  assert.equal(tabs[0].focused, true);
  assert.equal(tabs[0].clicked, true);
});

test('frequency radios support arrow keys and Home/End', () => {
  const radios = createItems(4);
  const { event } = createKeyEvent('ArrowLeft', 'radio', radios, 0);

  handleRadioKeyDown(event);
  assert.equal(radios[3].focused, true);
  assert.equal(radios[3].clicked, true);

  const endEvent = createKeyEvent('End', 'radio', radios, 0).event;
  handleRadioKeyDown(endEvent);
  assert.equal(radios[3].focused, true);
  assert.equal(radios[3].clicked, true);
});