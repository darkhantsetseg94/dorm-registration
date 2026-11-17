const config = require('../config');

/** Тухайн цагийн бүсээр огнооны хэсгүүдийг авна: { year, month (1–12), day } */
function dateParts(now = new Date(), timeZone = config.timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Өнөөдрийн огноо "YYYY-MM-DD" хэлбэрээр (Улаанбаатарын цагаар) */
function today(now = new Date()) {
  const { year, month, day } = dateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 8-р сараас хойш шинэ хичээлийн жил эхэлнэ: 2026-10 → "2026-2027" */
function currentAcademicYear(now = new Date()) {
  const { year, month } = dateParts(now);
  const start = month >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** "2026-2027" → "2025-2026" */
function previousAcademicYear(academicYear) {
  const start = Number(academicYear.slice(0, 4)) - 1;
  return `${start}-${start + 1}`;
}

module.exports = { today, currentAcademicYear, previousAcademicYear, dateParts };
