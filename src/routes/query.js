const { STATUS_LABELS } = require('../constants');
const { currentAcademicYear } = require('../utils/time');
const { parsePositiveInt } = require('../validators/common');
const { badRequest } = require('../errors');

/**
 * URL query параметрүүдийг шалгах туслах функцүүд.
 * Буруу утга ирвэл 400 буцаана — SQL-д хэзээ ч шууд оруулахгүй.
 */

// qs нь ?a[]=1 гэх мэтийг массив болгодог тул зөвхөн string-ийг зөвшөөрнө
function ensureString(value) {
  if (value !== undefined && typeof value !== 'string') throw badRequest('Параметр буруу байна');
}

/** ?year=2026-2027 | all (бүх жил → null) | хоосон (одоогийн жил) */
function yearParam(value) {
  ensureString(value);
  if (value === undefined || value === '') return currentAcademicYear();
  if (value === 'all') return null;
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) throw badRequest('Хичээлийн жил буруу байна');
  return value;
}

function statusParam(value) {
  ensureString(value);
  if (value === undefined || value === '' || value === 'all') return null;
  if (!Object.hasOwn(STATUS_LABELS, value)) throw badRequest('Төлөв буруу байна');
  return value;
}

function idParam(value, message = 'Дугаар буруу байна') {
  ensureString(value);
  if (value === undefined || value === '') return null;
  const id = parsePositiveInt(value);
  if (Number.isNaN(id)) throw badRequest(message);
  return id;
}

function searchParam(value) {
  ensureString(value);
  if (value === undefined) return null;
  const q = value.trim();
  if (q.length > 60) throw badRequest('Хайлтын утга хэт урт байна');
  return q || null;
}

function pageParams(query, defaultSize = 20) {
  const page = idParam(query.page, 'Хуудасны дугаар буруу байна') || 1;
  const pageSize = Math.min(idParam(query.pageSize, 'Хуудасны хэмжээ буруу байна') || defaultSize, 100);
  return { page, pageSize };
}

function oneOf(value, allowed, fallback) {
  ensureString(value);
  if (value === undefined || value === '') return fallback;
  if (!allowed.includes(value)) throw badRequest('Параметр буруу байна');
  return value;
}

module.exports = { yearParam, statusParam, idParam, searchParam, pageParams, oneOf };
