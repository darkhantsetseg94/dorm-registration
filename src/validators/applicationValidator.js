const PHONE_RE = /^\d{8}$/;
const NAME_RE = /^[A-Za-zА-Яа-яЁёӨөҮү .-]{2,60}$/u;
const HTML_RE = /<[^>]*>|javascript:/i;
const REASON_MIN = 10;
const REASON_MAX = 500;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Байрны ID-г хатуу шалгана. Number(true) === 1, Number([1]) === 1 болдог тул
 * зөвхөн бүхэл тоо эсвэл цифрээс бүрдсэн string-ийг зөвшөөрнө.
 */
function parsePositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : NaN;
  if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value.trim())) return Number(value.trim());
  return NaN;
}

/**
 * Хүсэлтийн form-ыг шалгана. Зөвхөн зөвшөөрөгдсөн 5 талбарыг уншина (whitelist),
 * тул studentId, status зэрэг илүү талбар data-д хэзээ ч орохгүй.
 */
function validateApplication(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  }

  const errors = {};
  const phone = asTrimmedString(body.phone);
  const emergencyName = asTrimmedString(body.emergencyName);
  const emergencyPhone = asTrimmedString(body.emergencyPhone);
  const reason = asTrimmedString(body.reason);
  const dormId = parsePositiveInt(body.dormId);

  // Байр
  if (body.dormId === undefined || body.dormId === null || body.dormId === '') {
    errors.dormId = 'Байраа сонгоно уу';
  } else if (Number.isNaN(dormId)) {
    errors.dormId = 'Байрны сонголт буруу байна';
  }

  // Утас
  if (!phone) errors.phone = 'Утасны дугаараа оруулна уу';
  else if (!PHONE_RE.test(phone)) errors.phone = 'Утасны дугаар 8 оронтой байх ёстой (жишээ: 99112233)';

  // Яаралтай үед холбогдох хүн
  if (!emergencyName) errors.emergencyName = 'Яаралтай үед холбогдох хүний нэрийг оруулна уу';
  else if (!NAME_RE.test(emergencyName)) errors.emergencyName = 'Нэр зөвхөн үсгээс бүрдэх ёстой (2–60 тэмдэгт)';

  if (!emergencyPhone) errors.emergencyPhone = 'Яаралтай үед холбогдох утсыг оруулна уу';
  else if (!PHONE_RE.test(emergencyPhone)) errors.emergencyPhone = 'Утасны дугаар 8 оронтой байх ёстой';
  else if (phone && emergencyPhone === phone) errors.emergencyPhone = 'Өөрийн дугаараас өөр дугаар оруулна уу';

  // Шалтгаан
  if (!reason) errors.reason = 'Байранд суух шалтгаанаа бичнэ үү';
  else if (HTML_RE.test(reason)) errors.reason = 'HTML код болон тусгай тэмдэгт оруулах боломжгүй';
  else if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
    errors.reason = `Шалтгаан ${REASON_MIN}–${REASON_MAX} тэмдэгт байх ёстой`;
  }

  if (Object.keys(errors).length > 0) return { errors, data: null };
  return { errors: null, data: { dormId, phone, emergencyName, emergencyPhone, reason } };
}

module.exports = { validateApplication, parsePositiveInt, REASON_MIN, REASON_MAX };
