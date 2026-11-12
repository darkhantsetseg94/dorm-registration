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

const EDITABLE_FIELDS = ['dormId', 'phone', 'emergencyName', 'emergencyPhone', 'reason'];

/**
 * PATCH (оюутан хүсэлтээ засах): зөвхөн өгсөн талбарыг одоогийн утга дээр давхарлаж,
 * үр дүнг бүтнээр нь validateApplication-оор шалгана (жишээ нь утас ≠ яаралтай утас).
 * @param {object} body     хүсэлтийн body
 * @param {object} current  одоогийн утгууд { dormId, phone, emergencyName, emergencyPhone, reason }
 */
function validateApplicationUpdate(body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  }
  const changed = EDITABLE_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(body, f));
  if (changed.length === 0) {
    return { errors: { form: 'Өөрчлөх талбар өгөгдөөгүй байна' }, data: null };
  }
  const merged = { ...current };
  changed.forEach((f) => { merged[f] = body[f]; });
  const result = validateApplication(merged);
  if (result.errors) {
    // Зөвхөн өөрчилсөн талбарын алдааг буцаана
    const errors = {};
    Object.entries(result.errors).forEach(([k, v]) => { if (changed.includes(k)) errors[k] = v; });
    return { errors: Object.keys(errors).length ? errors : result.errors, data: null };
  }
  return { errors: null, data: result.data, changed };
}

const REVIEW_STATUSES = ['APPROVED', 'REJECTED'];
const NOTE_MAX = 300;

/**
 * PATCH (ажилтан шийдвэрлэх): status нь APPROVED эсвэл REJECTED.
 * Татгалзах үед шалтгаан (reviewNote) заавал.
 */
function validateReview(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  }
  const errors = {};
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  const reviewNote = asTrimmedString(body.reviewNote);

  if (!REVIEW_STATUSES.includes(status)) {
    errors.status = 'Шийдвэр нь APPROVED эсвэл REJECTED байх ёстой';
  }
  if (status === 'REJECTED' && !reviewNote) {
    errors.reviewNote = 'Татгалзсан шалтгаанаа бичнэ үү';
  } else if (reviewNote && HTML_RE.test(reviewNote)) {
    errors.reviewNote = 'HTML код болон тусгай тэмдэгт оруулах боломжгүй';
  } else if (reviewNote.length > NOTE_MAX) {
    errors.reviewNote = `Тайлбар ${NOTE_MAX} тэмдэгтээс ихгүй байна`;
  }

  if (Object.keys(errors).length > 0) return { errors, data: null };
  return { errors: null, data: { status, reviewNote: reviewNote || null } };
}

module.exports = {
  validateApplication,
  validateApplicationUpdate,
  validateReview,
  parsePositiveInt,
  EDITABLE_FIELDS,
  REASON_MIN,
  REASON_MAX,
};
