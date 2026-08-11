class OnScreenKeyboard {
  static INPUT_SELECTOR =
    'input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], input[type="number"], textarea';

  constructor() {
    this._root = null;
    this._active = null;
    this._shiftOn = false;
    this._symbolLayer = false;
    this._numeric = false;

    this._lettersLayout = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', { a: 'backspace', label: '⌫', cls: 'osk-action' }],
      [
        { a: 'shift', label: 'Shift', cls: 'osk-shift' },
        'z', 'x', 'c', 'v', 'b', 'n', 'm',
        { a: 'enter', label: 'Enter', cls: 'osk-enter' },
      ],
      [
        { a: 'toggle', label: '?123', cls: 'osk-toggle' },
        { a: 'space', label: 'Space', cls: 'osk-space' },
        '.',
      ],
    ];

    this._symbolsLayout = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['@', '#', '$', '%', '&', '*', '(', ')', '-', '+'],
      ['_', ':', ';', ',', '.', '?', '!', "'", '"', { a: 'backspace', label: '⌫', cls: 'osk-action' }],
      [
        { a: 'toggle', label: 'ABC', cls: 'osk-toggle' },
        { a: 'space', label: 'Space', cls: 'osk-space' },
        { a: 'enter', label: 'Enter', cls: 'osk-enter' },
      ],
    ];

    this._numericLayout = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['.', '-', { a: 'backspace', label: '⌫', cls: 'osk-action' }],
      [{ a: 'enter', label: 'Enter', cls: 'osk-enter osk-fill' }],
    ];

    this._init();
  }

  _init() {
    this._root = document.createElement('div');
    this._root.id = 'osk';
    this._root.className = 'osk hidden';
    this._root.setAttribute('role', 'application');
    this._root.setAttribute('aria-label', 'On-screen keyboard');
    this._root.addEventListener('pointerdown', (e) => {
      const key = e.target.closest('.osk-key');
      if (!key) return;
      e.preventDefault();
      const action = key.getAttribute('data-action');
      if (action && typeof this[action] === 'function') {
        this[action]();
        return;
      }
      const ch = key.getAttribute('data-key');
      if (ch !== null && ch !== '') this._type(ch);
    });
    document.body.appendChild(this._root);

    document.addEventListener('focusin', (e) => {
      if (e.target.matches && e.target.matches(OnScreenKeyboard.INPUT_SELECTOR)) {
        this._show(e.target);
      }
    });

    document.addEventListener('focusout', (e) => {
      if (!e.target.matches || !e.target.matches(OnScreenKeyboard.INPUT_SELECTOR)) return;
      setTimeout(() => {
        const ae = document.activeElement;
        if (this._root && this._root.contains(ae)) return;
        if (ae && ae.matches && ae.matches(OnScreenKeyboard.INPUT_SELECTOR)) return;
        this._hide();
      }, 0);
    });
  }

  _show(input) {
    this._active = input;
    this._numeric = input.type === 'number' || input.getAttribute('inputmode') === 'numeric';
    this._symbolLayer = false;
    this._shiftOn = false;
    this._render();
    this._root.classList.remove('hidden');
    setTimeout(() => {
      if (this._active) this._active.scrollIntoView({ block: 'nearest' });
    }, 50);
  }

  _hide() {
    this._active = null;
    if (this._root) this._root.classList.add('hidden');
  }

  _render() {
    const layout = this._numeric ? this._numericLayout
      : this._symbolLayer ? this._symbolsLayout
      : this._lettersLayout;
    const rowsHtml = layout.map((row) => {
      const keysHtml = row.map((k) => {
        if (typeof k === 'string') {
          return `<button type="button" class="osk-key" data-key="${this._esc(k)}">${this._esc(k)}</button>`;
        }
        const cls = ['osk-key', k.cls || ''].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-action="${k.a}">${this._esc(k.label)}</button>`;
      }).join('');
      return `<div class="osk-row">${keysHtml}</div>`;
    }).join('');

    const label = this._active ? (this._active.placeholder || this._active.getAttribute('name') || '') : '';
    const shiftActive = this._shiftOn && !this._symbolLayer;

    this._root.innerHTML = `
      <div class="osk-bar">
        <span class="osk-bar-label">${this._esc(label)}</span>
        <button type="button" class="osk-key osk-hide" data-action="hide">Hide</button>
      </div>
      ${rowsHtml}
    `;
    this._root.classList.toggle('osk-shift-on', shiftActive);
  }

  _type(ch) {
    if (this._shiftOn && !this._symbolLayer && /[a-z]/.test(ch)) {
      ch = ch.toUpperCase();
      this._shiftOn = false;
      this._render();
    }
    const el = this._active;
    if (!el) return;
    const start = el.selectionStart != null ? el.selectionStart : el.value.length;
    const end = el.selectionEnd != null ? el.selectionEnd : start;
    const val = el.value;
    el.value = val.slice(0, start) + ch + val.slice(end);
    const pos = start + ch.length;
    el.focus();
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  backspace() {
    const el = this._active;
    if (!el) return;
    const start = el.selectionStart != null ? el.selectionStart : el.value.length;
    const end = el.selectionEnd != null ? el.selectionEnd : start;
    const val = el.value;
    if (start === end) {
      if (start === 0) return;
      el.value = val.slice(0, start - 1) + val.slice(end);
      el.focus();
      el.setSelectionRange(start - 1, start - 1);
    } else {
      el.value = val.slice(0, start) + val.slice(end);
      el.focus();
      el.setSelectionRange(start, start);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  space() {
    this._type(' ');
  }

  shift() {
    if (this._symbolLayer) return;
    this._shiftOn = !this._shiftOn;
    this._render();
  }

  toggle() {
    this._symbolLayer = !this._symbolLayer;
    this._shiftOn = false;
    this._render();
  }

  enter() {
    const el = this._active;
    const form = el && el.form;
    this._hide();
    if (form) {
      try {
        form.requestSubmit();
      } catch (_) {
        if (el) el.blur();
      }
    } else if (el) {
      el.blur();
    }
  }

  hide() {
    this._hide();
    if (this._active) this._active.blur();
  }

  _esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }
}

window.OnScreenKeyboard = OnScreenKeyboard;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OnScreenKeyboard());
} else {
  new OnScreenKeyboard();
}
