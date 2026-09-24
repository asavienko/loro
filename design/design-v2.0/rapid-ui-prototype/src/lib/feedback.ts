// One-shot visual confirmations drawn above everything (rating, link copied).
// The chip itself is decoration; the words go to one persistent live region,
// which screen readers announce reliably (a freshly inserted status node
// often isn't).

const CHIP_MS = 1450;

function announce(text: string) {
  let region = document.getElementById('loro-status');
  if (!region) {
    region = document.createElement('div');
    region.id = 'loro-status';
    region.setAttribute('role', 'status');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  // Clearing first makes a repeated message count as new.
  region.textContent = '';
  const target = region;
  requestAnimationFrame(() => (target.textContent = text));
}

export function floatingChip(anchor: HTMLElement, text: string, tone: 'success' | 'info') {
  announce(text);
  const rect = anchor.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.setAttribute('aria-hidden', 'true');
  chip.className = `fixed z-[9999] px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap animate-float-chip shadow-lg pointer-events-none ${
    tone === 'success' ? 'bg-tertiary text-tertiary-fixed' : 'bg-inverse-surface text-inverse-on-surface'
  }`;
  chip.textContent = text;
  chip.style.left = `${rect.left + rect.width / 2}px`;
  chip.style.top = `${rect.top}px`;
  document.body.appendChild(chip);
  setTimeout(() => chip.remove(), CHIP_MS);
}
