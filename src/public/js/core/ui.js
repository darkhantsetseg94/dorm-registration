/**
 * Дахин ашиглагдах UI хэсгүүд: toast, modal, баталгаажуулалт, form-ын алдаа,
 * төлөвийн тэмдэг, хоосон төлөв.
 */
import { h, $, $$ } from './dom.js';
import { icon } from './icons.js';

// ---------------- Toast ----------------
let toastRegion;
export function toast(message, type = 'ok') {
  if (!toastRegion) {
    toastRegion = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastRegion);
  }
  const iconName = { ok: 'check', error: 'alert', info: 'info' }[type] || 'info';
  const el = h('div', { class: `toast toast-${type}` }, icon(iconName), h('div', {}, message));
  toastRegion.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3800);
}

// ---------------- Modal ----------------
/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.description]
 * @param {Node}   o.body
 * @param {Array}  [o.actions]  [{ label, variant, onClick, type, form }]
 * @param {boolean} [o.wide]
 * @returns {{ dialog: HTMLDialogElement, close: Function }}
 */
export function openModal({ title, description, body, actions = [], wide = false, onClose }) {
  const titleId = `m-${Math.random().toString(36).slice(2, 8)}`;
  const close = () => dialog.close();
  const dialog = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}`, 'aria-labelledby': titleId },
    h('div', { class: 'modal-head' },
      h('div', {}, h('h2', { id: titleId }, title), description ? h('p', {}, description) : null),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Хаах', onClick: close }, icon('x'))),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-foot' }, actions.map((a) => h('button', {
      class: `btn ${a.variant || ''}`.trim(),
      type: a.type || 'button',
      form: a.form || null,
      onClick: a.onClick ? (e) => a.onClick(e, close) : null,
    }, a.label))) : null);

  dialog.addEventListener('close', () => {
    dialog.remove();
    if (onClose) onClose();
  });
  // Арын бүдэг хэсэг дээр дарахад хаана
  dialog.addEventListener('mousedown', (e) => {
    if (e.target === dialog) close();
  });
  document.body.append(dialog);
  dialog.showModal();
  const first = $('input:not([type=hidden]), select, textarea', dialog);
  if (first) first.focus();
  return { dialog, close };
}

/** Баталгаажуулах цонх → Promise<boolean> */
export function confirmDialog({ title, message, confirmLabel = 'Тийм', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = openModal({
      title,
      body: h('p', { class: 'muted' }, message),
      actions: [
        { label: 'Болих', variant: 'btn-secondary', onClick: (e, c) => c() },
        {
          label: confirmLabel,
          variant: danger ? 'btn-danger' : '',
          onClick: (e, c) => { answered = true; resolve(true); c(); },
        },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
    return close;
  });
}

// ---------------- Form ----------------
/** Form-ын бүх талбарын алдааг арилгана */
export function clearErrors(root) {
  $$('.field.has-error', root).forEach((f) => f.classList.remove('has-error'));
  $$('.field-error', root).forEach((e) => { e.textContent = ''; });
  $$('[aria-invalid]', root).forEach((e) => e.removeAttribute('aria-invalid'));
}

/**
 * Серверээс ирсэн { field: message } алдааг талбар бүрийн доор харуулна.
 * Талбарыг data-field="name" эсвэл name="name"-ээр олно.
 * @returns {string[]} алдаатай талбаруудын нэр
 */
export function showErrors(root, details = {}) {
  const shown = [];
  Object.entries(details).forEach(([name, message]) => {
    const field = $(`[data-field="${name}"]`, root) || $(`[name="${name}"]`, root)?.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    const box = $('.field-error', field);
    if (box) box.textContent = message;
    const input = $('input, select, textarea', field);
    if (input) input.setAttribute('aria-invalid', 'true');
    shown.push(name);
  });
  const firstInvalid = $('[aria-invalid="true"]', root);
  if (firstInvalid) firstInvalid.focus();
  return shown;
}

/** Товчийг ачаалж буй төлөвт оруулна */
export function setBusy(button, busy) {
  if (!button) return;
  if (busy) {
    button.disabled = true;
    button.dataset.label = button.dataset.label || button.textContent;
    button.prepend(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
    button.setAttribute('aria-busy', 'true');
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    $('.spinner', button)?.remove();
  }
}

/**
 * Form талбар үүсгэнэ.
 * field({ label, name, input: h('input', …), hint, optional })
 */
export function field({ label, name, input, hint = null, optional = false, id = null }) {
  const inputId = id || `f-${name}`;
  input.id = input.id || inputId;
  if (!input.name && name) input.name = name;
  return h('div', { class: 'field', dataset: { field: name } },
    h('label', { for: input.id }, label, optional ? h('span', { class: 'optional' }, ' (заавал биш)') : null),
    input,
    hint ? h('div', { class: 'hint' }, hint) : null,
    h('div', { class: 'field-error', 'aria-live': 'polite' }));
}

/** Select-ийн сонголтууд: [[value, label], ...] */
export function options(pairs, selected = '', placeholder = null) {
  const list = placeholder !== null ? [['', placeholder], ...pairs] : pairs;
  return list.map(([value, label]) => h('option', { value: String(value), selected: String(value) === String(selected ?? '') }, label));
}

// ---------------- Тэмдэг, төлөв ----------------
export function statusBadge(status, label, large = false) {
  return h('span', { class: `badge st-${status}${large ? ' badge-lg' : ''}` }, label);
}

export function emptyState({ iconName = 'inbox', title, text = '', action = null }) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon' }, icon(iconName, 'icon-lg')),
    h('h3', {}, title),
    text ? h('p', {}, text) : null,
    action);
}

export function loadingBlock(text = 'Ачаалж байна…') {
  return h('div', { class: 'loading-block' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { class: 'sr-only' }, text));
}

export function errorBlock(message, retry) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon' }, icon('alert', 'icon-lg')),
    h('h3', {}, 'Мэдээлэл ачаалж чадсангүй'),
    h('p', {}, message),
    retry ? h('button', { class: 'btn btn-secondary', type: 'button', onClick: retry }, 'Дахин оролдох') : null);
}

/** Орны цэгүүд: occupied=2, capacity=3 → ●●○ */
export function beds(capacity, { male = 0, female = 0, self = false } = {}) {
  const items = [];
  for (let i = 0; i < capacity; i += 1) {
    let cls = 'bed';
    if (i < male) cls += ' is-male';
    else if (i < male + female) cls += ' is-female';
    items.push(h('i', { class: cls }));
  }
  if (self && items[male + female]) items[male + female].classList.add('is-self');
  return h('span', { class: 'beds', 'aria-hidden': 'true' }, items);
}

/** Байрны дүүргэлтийн мөр */
export function meter(capacity, approved, pending = 0, large = false) {
  const pct = (n) => `${Math.min((n / Math.max(capacity, 1)) * 100, 100)}%`;
  const pendingShown = Math.min(pending, Math.max(capacity - approved, 0));
  const bar = h('div', {
    class: `meter${large ? ' meter-lg' : ''}`,
    role: 'img',
    'aria-label': `${capacity} орноос ${approved} нь эзэмшигдсэн, ${pending} хүсэлт хүлээгдэж байна`,
  }, h('span', { class: 'm-approved' }), h('span', { class: 'm-pending' }));
  bar.children[0].style.width = pct(approved);
  bar.children[1].style.width = pct(pendingShown);
  if (pendingShown === 0) bar.children[1].classList.add('is-zero');
  return bar;
}

/**
 * Form-той modal. onSubmit нь Promise буцаана; алдааны details-ийг талбар бүрт харуулна.
 * @returns {{ form: HTMLFormElement, close: Function }}
 */
export function formModal({ title, description, fields, submitLabel = 'Хадгалах', submitVariant = '', onSubmit, extraActions = [], wide = false }) {
  const formId = `mf-${Math.random().toString(36).slice(2, 8)}`;
  const form = h('form', { id: formId, class: 'form', novalidate: true }, fields);
  const { close, dialog } = openModal({
    title,
    description,
    body: form,
    wide,
    actions: [
      ...extraActions,
      { label: 'Болих', variant: 'btn-secondary', onClick: (e, c) => c() },
      { label: submitLabel, variant: submitVariant, type: 'submit', form: formId },
    ],
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const button = dialog.querySelector(`button[form="${formId}"]`);
    setBusy(button, true);
    try {
      const message = await onSubmit(form);
      close();
      if (message) toast(message);
    } catch (err) {
      setBusy(button, false);
      if (err.details) showErrors(form, err.details);
      toast(err.message, 'error');
    }
  });
  return { form, close };
}

/** Switch (асаах/унтраах) талбар */
export function switchField({ name, label, text, checked }) {
  return h('label', { class: 'switch', dataset: { field: name } },
    h('input', { type: 'checkbox', name, checked: Boolean(checked), role: 'switch' }),
    h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    h('span', { class: 'switch-text' }, h('strong', {}, label), text ? h('span', {}, text) : null));
}
