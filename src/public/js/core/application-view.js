/**
 * Хүсэлтийн мэдээллийг харуулах дундын хэсгүүд (оюутан болон ажилтанд).
 */
import { h } from './dom.js';
import { icon } from './icons.js';
import { fmtDateTime, money } from './format.js';

/** Тайлбар жагсаалт: [[нэр, утга], ...] — утга хоосон бол алгасна */
export function dl(rows) {
  return h('dl', { class: 'dl' }, rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]));
}

export function tagChips(app) {
  if (!app.priorityLabels || app.priorityLabels.length === 0) return null;
  return h('div', { class: 'chips' }, app.priorityLabels.map((label) => h('span', { class: 'chip chip-brass' }, label)));
}

/** Хүсэлтийн түүх (дарааллаар) */
export function timeline(events = []) {
  return h('ol', { class: 'timeline' }, events.map((e) => h('li', { class: `is-${e.action}` },
    h('div', { class: 't-title' }, e.label),
    h('div', { class: 't-meta' }, fmtDateTime(e.createdAt), e.actorName && e.actorRole === 'staff' ? `, ${e.actorName}` : ''),
    e.note ? h('div', { class: 't-note' }, e.note) : null)));
}

export function roomText(app) {
  if (!app.roomNumber) return null;
  return app.roomFloor !== null && app.roomFloor !== undefined
    ? `${app.roomNumber} тоот (${app.roomFloor}-р давхар)`
    : `${app.roomNumber} тоот`;
}

/** Хүсэлтийн бүх мэдээлэл — блок блокоор */
export function detailBlocks(app, { showStudent = false } = {}) {
  const blocks = [];
  if (showStudent) {
    blocks.push(h('section', {},
      h('h3', { class: 'block-title' }, icon('user', 'icon-sm'), 'Оюутан'),
      dl([
        ['Овог нэр', app.student.name],
        ['Оюутны код', app.student.code],
        ['Хүйс', app.student.genderLabel],
        ['Имэйл', app.student.email],
      ])));
  }
  blocks.push(h('section', {},
    h('h3', { class: 'block-title' }, icon('building', 'icon-sm'), 'Байр'),
    dl([
      ['Хичээлийн жил', app.academicYear],
      ['Байр', app.dormName],
      ['Өрөө', roomText(app) || (app.status === 'APPROVED' ? 'Хуваарилаагүй' : null)],
      ['Сарын төлбөр', app.dormFee ? money(app.dormFee) : null],
    ])));
  blocks.push(h('section', {},
    h('h3', { class: 'block-title' }, icon('phone', 'icon-sm'), 'Холбоо барих'),
    dl([
      ['Утас', app.phone],
      ['Яаралтай үед', app.emergencyRelation ? `${app.emergencyName} (${app.emergencyRelation})` : app.emergencyName],
      ['Түүний утас', app.emergencyPhone],
    ])));
  blocks.push(h('section', {},
    h('h3', { class: 'block-title' }, icon('info', 'icon-sm'), 'Нэмэлт мэдээлэл'),
    dl([
      ['Аймаг, хот', app.homeProvince],
      ['Курс', app.courseLabel],
      ['Илгээсэн', fmtDateTime(app.createdAt)],
    ]),
    app.priorityLabels.length ? h('div', { class: 'mt-12' }, tagChips(app)) : null));
  blocks.push(h('section', {},
    h('h3', { class: 'block-title' }, icon('file', 'icon-sm'), 'Байранд суух шалтгаан'),
    h('p', { class: 'quote' }, app.reason)));
  if (app.staffNote) {
    blocks.push(h('section', {},
      h('h3', { class: 'block-title' }, icon('megaphone', 'icon-sm'), 'Ажилтны тайлбар'),
      h('p', { class: 'quote' }, app.staffNote)));
  }
  if (app.events) {
    blocks.push(h('section', {},
      h('h3', { class: 'block-title' }, icon('clock', 'icon-sm'), 'Түүх'),
      timeline(app.events)));
  }
  return blocks;
}
