/**
 * Ажилтан: мэдээлэл, зарлал нийтлэх.
 */
import { h, $, render } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { initPage } from '../core/layout.js';
import {
  toast, confirmDialog, formModal, switchField, field, options, emptyState, loadingBlock, errorBlock,
} from '../core/ui.js';
import { fmtDateTime } from '../core/format.js';

const { meta } = await initPage({ role: 'staff', active: 'announcements', title: 'Мэдээлэл' });

$('#add').append(icon('plus'), 'Мэдээлэл нийтлэх');
$('#add').addEventListener('click', () => editor(null));

function editor(item) {
  const title = Object.assign(h('input', { class: 'input', maxlength: '120' }), { value: item?.title || '' });
  const body = h('textarea', { class: 'textarea', maxlength: '3000', rows: 6 });
  body.value = item?.body || '';
  formModal({
    title: item ? 'Мэдээлэл засах' : 'Мэдээлэл нийтлэх',
    wide: true,
    fields: [
      field({ label: 'Гарчиг', name: 'title', input: title }),
      field({ label: 'Агуулга', name: 'body', input: body }),
      field({ label: 'Хэнд харагдах', name: 'audience', input: h('select', { class: 'select' }, options(Object.entries(meta.audiences), item?.audience || 'student')) }),
      switchField({ name: 'isPinned', label: 'Онцлох', text: 'Онцолсон мэдээлэл жагсаалтын хамгийн дээр харагдана.', checked: item?.isPinned }),
    ],
    submitLabel: item ? 'Хадгалах' : 'Нийтлэх',
    async onSubmit(form) {
      const payload = {
        title: form.elements.namedItem('title').value.trim(),
        body: form.elements.namedItem('body').value.trim(),
        audience: form.elements.namedItem('audience').value,
        isPinned: form.elements.namedItem('isPinned').checked,
      };
      const data = item ? await api.put(`/api/admin/announcements/${item.id}`, payload) : await api.post('/api/admin/announcements', payload);
      load();
      return data.message;
    },
  });
}

async function remove(item) {
  const ok = await confirmDialog({ title: 'Мэдээллийг устгах уу?', message: `"${item.title}" бүх хэрэглэгчээс устана.`, confirmLabel: 'Устгах', danger: true });
  if (!ok) return;
  try {
    const data = await api.del(`/api/admin/announcements/${item.id}`);
    toast(data.message);
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function load() {
  const list = $('#list');
  render(list, loadingBlock());
  try {
    const { announcements } = await api.get('/api/admin/announcements');
    if (announcements.length === 0) {
      render(list, emptyState({
        iconName: 'megaphone', title: 'Мэдээлэл нийтлээгүй байна',
        text: 'Хүсэлт авах хугацаа, бичиг баримтын шаардлага зэргийг оюутнуудад эндээс мэдэгдэнэ.',
        action: h('button', { class: 'btn', type: 'button', onClick: () => editor(null) }, icon('plus'), 'Мэдээлэл нийтлэх'),
      }));
      return;
    }
    render(list, announcements.map((a) => h('article', { class: 'announcement-row' },
      h('div', {},
        h('h3', {}, a.isPinned ? h('span', { title: 'Онцолсон' }, icon('pin', 'icon-sm')) : null, a.title,
          h('span', { class: a.audience === 'staff' ? 'chip chip-lapis' : 'chip' }, a.audienceLabel)),
        h('p', {}, a.body),
        h('div', { class: 'meta' }, `${a.authorName || 'Систем'}, ${fmtDateTime(a.createdAt)}`, a.updatedAt !== a.createdAt ? ' (зассан)' : '')),
      h('div', { class: 'table-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => editor(a) }, icon('pencil', 'icon-sm'), 'Засах'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => remove(a), 'aria-label': `${a.title} устгах` }, icon('trash', 'icon-sm'))))));
  } catch (err) {
    render(list, errorBlock(err.message, load));
  }
}

load();
