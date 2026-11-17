/**
 * Хуудасны хүрээ (shell): ажилтанд хажуу цэс, оюутанд дээд цэс + утсан дээр доод цэс.
 * Мэдэгдэл, хэрэглэгчийн цэс, өнгөний горимыг энд удирдана.
 *
 * Хэрэглээ:  const { user, meta } = await initPage({ role: 'student', active: 'dashboard', title: 'Нүүр' });
 */
import { h, $, render } from './dom.js';
import { icon } from './icons.js';
import { api, goToLogin } from './api.js';
import { initials, timeAgo, yearLabel } from './format.js';
import { toast } from './ui.js';

const STAFF_NAV = [
  { key: 'overview', href: '/admin/', label: 'Хянах самбар', icon: 'dashboard' },
  { key: 'applications', href: '/admin/applications.html', label: 'Хүсэлтүүд', icon: 'inbox', count: true },
  { key: 'dorms', href: '/admin/dorms.html', label: 'Байр, өрөө', icon: 'building' },
  { key: 'users', href: '/admin/users.html', label: 'Хэрэглэгчид', icon: 'users' },
  { key: 'announcements', href: '/admin/announcements.html', label: 'Мэдээлэл', icon: 'megaphone' },
  { key: 'settings', href: '/admin/settings.html', label: 'Тохиргоо', icon: 'sliders' },
];

const STUDENT_NAV = [
  { key: 'dashboard', href: '/dashboard.html', label: 'Нүүр', icon: 'home' },
  { key: 'apply', href: '/apply.html', label: 'Хүсэлт', icon: 'file' },
  { key: 'profile', href: '/profile.html', label: 'Профайл', icon: 'user' },
];

// ---------------- Өнгөний горим ----------------
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('odb-theme', theme); } catch (e) { /* хадгалж чадахгүй бол зүгээр */ }
  document.dispatchEvent(new CustomEvent('themechange'));
}

export function themeButton() {
  const btn = h('button', { class: 'icon-btn', type: 'button' });
  const paint = () => {
    const dark = currentTheme() === 'dark';
    btn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    btn.setAttribute('aria-label', dark ? 'Цайвар горим' : 'Бараан горим');
    btn.title = btn.getAttribute('aria-label');
  };
  btn.addEventListener('click', () => { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); paint(); });
  document.addEventListener('themechange', paint);
  paint();
  return btn;
}

// ---------------- Popover ----------------
let openPopover = null;
function closePopover() {
  if (openPopover) {
    openPopover.panel.remove();
    openPopover.trigger.setAttribute('aria-expanded', 'false');
    openPopover = null;
  }
}
document.addEventListener('click', (e) => {
  if (openPopover && !openPopover.anchor.contains(e.target)) closePopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openPopover) {
    const { trigger } = openPopover;
    closePopover();
    trigger.focus();
  }
});

function togglePopover(anchor, trigger, build) {
  if (openPopover && openPopover.trigger === trigger) { closePopover(); return; }
  closePopover();
  const panel = build();
  anchor.append(panel);
  trigger.setAttribute('aria-expanded', 'true');
  openPopover = { anchor, trigger, panel };
}

// ---------------- Мэдэгдэл ----------------
function notificationsControl() {
  const anchor = h('div', { class: 'popover-anchor' });
  const dot = h('span', { class: 'dot', hidden: true });
  const trigger = h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': 'Мэдэгдэл', 'aria-haspopup': 'true', 'aria-expanded': 'false',
  }, icon('bell'), dot);
  anchor.append(trigger);

  const setCount = (n) => {
    dot.hidden = n === 0;
    dot.textContent = n > 9 ? '9+' : String(n);
    trigger.setAttribute('aria-label', n ? `Мэдэгдэл, ${n} уншаагүй` : 'Мэдэгдэл');
  };

  async function refresh() {
    try {
      const data = await api.get('/api/notifications');
      setCount(data.unread);
      return data;
    } catch (e) {
      return null;
    }
  }

  function buildPanel() {
    const list = h('div', { class: 'popover-list' }, h('div', { class: 'loading-block' }, h('span', { class: 'spinner' })));
    const readAll = h('button', { class: 'link-btn small', type: 'button' }, 'Бүгдийг уншсан');
    const panel = h('div', { class: 'popover', role: 'dialog', 'aria-label': 'Мэдэгдэл' },
      h('div', { class: 'popover-head' }, h('h3', {}, 'Мэдэгдэл'), readAll),
      list);

    readAll.addEventListener('click', async () => {
      await api.post('/api/notifications/read-all');
      setCount(0);
      list.querySelectorAll('.notif').forEach((n) => n.classList.add('is-read'));
    });

    refresh().then((data) => {
      if (!data) return render(list, h('p', { class: 'empty small' }, 'Мэдэгдэл ачаалж чадсангүй'));
      if (data.notifications.length === 0) {
        return render(list, h('div', { class: 'empty' }, h('p', {}, 'Одоогоор мэдэгдэл алга. Хүсэлтийн шийдвэр гармагц энд харагдана.')));
      }
      return render(list, data.notifications.map((n) => {
        const item = h('a', { class: `notif${n.isRead ? ' is-read' : ''}`, href: n.link || '#' },
          h('span', { class: 'n-dot' }),
          h('div', {}, h('strong', {}, n.title), n.body ? h('p', {}, n.body) : null, h('time', {}, timeAgo(n.createdAt))));
        item.addEventListener('click', async (e) => {
          if (!n.isRead) {
            e.preventDefault();
            await api.post(`/api/notifications/${n.id}/read`).catch(() => {});
            window.location.href = n.link || window.location.href;
          }
        });
        return item;
      }));
    });
    return panel;
  }

  trigger.addEventListener('click', () => togglePopover(anchor, trigger, buildPanel));
  refresh();
  // Минут тутам шинэ мэдэгдэл шалгана (хуудас харагдаж байх үед)
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
  return anchor;
}

// ---------------- Хэрэглэгчийн цэс ----------------
async function logout() {
  try { await api.post('/api/auth/logout'); } catch (e) { /* аль хэдийн гарсан */ }
  window.location.href = '/login.html';
}

function userMenu(user) {
  const anchor = h('div', { class: 'popover-anchor' });
  const trigger = h('button', { class: 'user-chip', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
    h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(user.fullName)),
    h('span', { class: 'user-chip-name' }, user.fullName));
  trigger.setAttribute('aria-label', `${user.fullName}, хэрэглэгчийн цэс`);
  anchor.append(trigger);

  trigger.addEventListener('click', () => togglePopover(anchor, trigger, () => h('div', { class: 'popover popover-sm' },
    h('div', { class: 'menu-user' }, h('strong', {}, user.fullName),
      h('span', {}, user.role === 'staff' ? `Ажилтан, ${user.username}` : `Оюутан, ${user.username}`)),
    h('div', { class: 'menu-list' },
      h('a', { href: '/profile.html' }, icon('user'), 'Профайл, нууц үг'),
      h('button', { type: 'button', onClick: logout }, icon('logout'), 'Системээс гарах')))));
  return anchor;
}

// ---------------- Shell ----------------
function brand(href) {
  return h('a', { class: 'brand', href },
    h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'ОДБ'),
    h('span', { class: 'brand-text' }, 'Дотуур байр', h('small', {}, 'Бүртгэлийн систем')));
}

function navLink(item, active, extra = null) {
  return h('a', { href: item.href, 'aria-current': item.key === active ? 'page' : null }, icon(item.icon), h('span', {}, item.label), extra);
}

function buildStaffShell(user, meta, active, title) {
  const count = h('span', { class: 'nav-count', hidden: true });
  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Үндсэн цэс' },
    brand('/admin/'),
    h('nav', { class: 'nav' }, STAFF_NAV.map((item) => navLink(item, active, item.count ? count : null))),
    h('div', { class: 'sidebar-foot' }, `${yearLabel(meta.window.academicYear)} хичээлийн жил`));

  const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Цэс нээх', 'aria-controls': 'sidebar' }, icon('menu'));
  const topbar = h('header', { class: 'topbar' },
    menuBtn,
    h('div', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-actions' }, themeButton(), notificationsControl(), userMenu(user)));

  let scrim = null;
  const closeNav = () => { document.body.classList.remove('nav-open'); scrim?.remove(); scrim = null; };
  menuBtn.addEventListener('click', () => {
    document.body.classList.add('nav-open');
    scrim = h('div', { class: 'nav-scrim', onClick: closeNav });
    document.body.append(scrim);
  });

  const main = $('#main');
  const col = h('div', { class: 'app-col' }, topbar);
  main.before(col);
  col.append(main);
  col.before(sidebar);
  document.body.classList.add('shell-staff');

  // Хүлээгдэж буй хүсэлтийн тоо
  api.get('/api/admin/applications?pageSize=1').then((data) => {
    const n = data.counts.PENDING;
    count.hidden = n === 0;
    count.textContent = String(n);
  }).catch(() => {});
  return { pendingCount: count };
}

function buildStudentShell(user, active) {
  const bar = h('header', { class: 'student-bar' },
    h('div', { class: 'student-bar-inner' },
      brand('/dashboard.html'),
      h('nav', { class: 'student-nav', 'aria-label': 'Үндсэн цэс' }, STUDENT_NAV.map((item) => navLink(item, active))),
      h('div', { class: 'topbar-actions' }, themeButton(), notificationsControl(), userMenu(user))));
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Үндсэн цэс' }, STUDENT_NAV.map((item) => navLink(item, active)));
  $('#main').before(bar);
  document.body.append(tabbar);
  document.body.classList.add('shell-student');
}

/**
 * Хуудсыг эхлүүлнэ: нэвтэрсэн эсэх, эрхийг шалгаад shell-ийг зурна.
 * @param {{ role: 'student'|'staff'|'any', active: string, title: string }} o
 */
export async function initPage({ role = 'any', active = '', title = '' }) {
  document.body.prepend(h('a', { class: 'skip-link', href: '#main' }, 'Үндсэн агуулга руу шилжих'));
  let user;
  let meta;
  try {
    [{ user }, meta] = await Promise.all([api.get('/api/auth/me'), api.get('/api/meta')]);
  } catch (err) {
    if (err.status === 401) goToLogin();
    else toast(err.message, 'error');
    throw err;
  }
  if (role !== 'any' && user.role !== role) {
    window.location.href = user.role === 'staff' ? '/admin/' : '/dashboard.html';
    throw new Error('wrong role');
  }

  let shell = {};
  if (user.role === 'staff') shell = buildStaffShell(user, meta, active, title);
  else buildStudentShell(user, active);
  document.body.classList.remove('is-booting');
  return { user, meta, shell };
}
