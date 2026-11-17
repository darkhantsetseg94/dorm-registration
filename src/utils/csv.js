/**
 * CSV үүсгэгч. Excel монгол үсгийг зөв уншихын тулд UTF-8 BOM нэмнэ.
 *
 * CSV injection хамгаалалт: "=", "+", "-", "@" тэмдэгтээр эхэлсэн нүдийг
 * Excel томьёо гэж ажиллуулахаас сэргийлж урд нь ' тавина.
 */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

module.exports = { toCsv, escapeCell };
