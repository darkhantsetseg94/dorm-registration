/**
 * DOM туслах функцүүд.
 * h() нь хэрэглэгчийн текстийг үргэлж textContent-оор оруулдаг тул XSS-ээс хамгаалагдсан.
 */

/** Child-уудыг элементэд нэмнэ (string → text node) */
export function append(el, ...children) {
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}

/**
 * Элемент үүсгэнэ: h('button', { class: 'btn', onClick: fn }, 'Хадгалах')
 * props: class, dataset, text, on<Event>, boolean/property утгууд (checked, disabled, value)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && typeof value !== 'string') el[key] = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  });
  return append(el, children);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Агуулгыг солино */
export function render(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** URL-ийн query параметрүүд */
export const params = () => new URLSearchParams(window.location.search);

/** Хайлт бичих үед хүсэлтийг хойшлуулна */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
