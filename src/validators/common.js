/**
 * Validator-уудын дундын дүрэм, туслах функц.
 * Бүх шалгалт whitelist зарчмаар: зөвшөөрөгдсөн утгаас бусдыг татгалзана.
 */

// Монгол улсын 8 оронтой гар утасны дугаар (6, 7, 8, 9-өөр эхэлнэ)
const PHONE_RE = /^[6-9]\d{7}$/;
// Кирилл (Ө, Ү орсон) болон латин үсэг, зай, цэг, зураас
const NAME_RE = /^[A-Za-zА-ЯЁӨҮа-яёөү .-]{2,60}$/;
// HTML tag эсвэл javascript: протокол (XSS оролдлого)
const HTML_RE = /<[^>]*>|javascript:/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Оюутны код: 1–2 латин үсэг + 6–10 цифр (жишээ: B221910001)
const STUDENT_CODE_RE = /^[A-Z]{1,2}\d{6,10}$/;
// Ажилтны нэвтрэх нэр
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function isPlainObject(body) {
  return Boolean(body) && typeof body === 'object' && !Array.isArray(body);
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * ID-г хатуу шалгана. Number(true) === 1, Number([1]) === 1 болдог тул
 * зөвхөн бүхэл тоо эсвэл цифрээс бүрдсэн string-ийг зөвшөөрнө.
 */
function parsePositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : NaN;
  if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value.trim())) return Number(value.trim());
  return NaN;
}

/** min–max хооронд бүхэл тоо уу? Үгүй бол NaN */
function parseIntInRange(value, min, max) {
  let n = NaN;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^-?\d{1,10}$/.test(value.trim())) n = Number(value.trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
}

/** true/false эсвэл 1/0-г boolean болгоно, бусад үед null */
function parseBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
}

/** "YYYY-MM-DD" бодит огноо эсэх */
function isValidDate(text) {
  if (!DATE_RE.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Нууц үгийн бодлого. Асуудалтай бол мессеж, зөв бол null буцаана. */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length === 0) return 'Нууц үгээ оруулна уу';
  if (password.length < PASSWORD_MIN) return `Нууц үг дор хаяж ${PASSWORD_MIN} тэмдэгт байна`;
  if (password.length > PASSWORD_MAX) return `Нууц үг ${PASSWORD_MAX} тэмдэгтээс хэтрэхгүй`;
  if (!/[A-Za-zА-Яа-яЁёӨөҮү]/.test(password) || !/\d/.test(password)) {
    return 'Нууц үг үсэг болон тоо агуулсан байна';
  }
  return null;
}

/**
 * Заавал биш текст талбар. Хоосон бол null буцаана.
 * @returns {string|null|undefined}  undefined = алдаатай (errors-д бичигдсэн)
 */
function optionalText(body, key, errors, { max, label = 'Текст' }) {
  const raw = body[key];
  if (isBlank(raw)) return null;
  if (typeof raw !== 'string') {
    errors[key] = `${label} буруу байна`;
    return undefined;
  }
  const text = raw.trim();
  if (HTML_RE.test(text)) errors[key] = 'HTML код болон тусгай тэмдэгт оруулах боломжгүй';
  else if (text.length > max) errors[key] = `${label} ${max} тэмдэгтээс хэтрэхгүй`;
  return errors[key] ? undefined : text;
}

/** Заавал бөглөх текст талбар (min–max урттай, HTML-гүй) */
function requiredText(body, key, errors, { min, max, label, emptyMessage }) {
  const text = asTrimmedString(body[key]);
  if (!text) errors[key] = emptyMessage || `${label} оруулна уу`;
  else if (HTML_RE.test(text)) errors[key] = 'HTML код болон тусгай тэмдэгт оруулах боломжгүй';
  else if (text.length < min || text.length > max) errors[key] = `${label} ${min}–${max} тэмдэгт байх ёстой`;
  return errors[key] ? undefined : text;
}

function result(errors, data) {
  return Object.keys(errors).length > 0 ? { errors, data: null } : { errors: null, data };
}

/** URL-ийн :id параметр эерэг бүхэл тоо эсэхийг шалгана. */
function parseId(value) {
  return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

module.exports = {
  PHONE_RE,
  NAME_RE,
  HTML_RE,
  EMAIL_RE,
  STUDENT_CODE_RE,
  USERNAME_RE,
  PASSWORD_MAX,
  isPlainObject,
  asTrimmedString,
  isBlank,
  parsePositiveInt,
  parseIntInRange,
  parseBool,
  isValidDate,
  passwordProblem,
  optionalText,
  requiredText,
  result,
  parseId,
};
