export function handleRovingKeyDown(event, role = 'tab') {
  const containerRole = role === 'radio' ? 'radiogroup' : 'tablist';
  const items = Array.from(event.currentTarget.closest(`[role="${containerRole}"]`)?.querySelectorAll(`[role="${role}"]`) || []);
  const currentIndex = items.indexOf(event.currentTarget);
  if (currentIndex < 0 || items.length < 2) return;

  let nextIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % items.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + items.length) % items.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = items.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  items[nextIndex].focus();
  items[nextIndex].click();
}

export const handleTabKeyDown = (event) => handleRovingKeyDown(event, 'tab');
export const handleRadioKeyDown = (event) => handleRovingKeyDown(event, 'radio');