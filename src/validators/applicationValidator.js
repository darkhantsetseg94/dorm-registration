const { PROVINCES, PRIORITY_TAGS, RELATIONS } = require('../constants');
const {
  PHONE_RE, NAME_RE, HTML_RE, isPlainObject, asTrimmedString, isBlank,
  parsePositiveInt, parseIntInRange, result, parseId,
} = require('./common');

const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * Дотуур байрны хүсэлтийн form-ыг шалгана (whitelist зарчмаар).
 * Зөвхөн зөвшөөрөгдсөн талбаруудыг буцаана — studentId, status гэх мэт
 * талбарыг хэрэглэгч өөрөө дамжуулж чадахгүй (mass assignment).
 *
 * Заавал: dormId, phone, emergencyName, emergencyPhone, reason
 * Заавал биш: emergencyRelation, homeProvince, courseYear, priorityTags
 *
 * @returns {{ errors: object|null, data: object|null }}
 */
function validateApplication(body) {
  if (!isPlainObject(body)) {
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

  // ---- Заавал биш талбарууд ----
  let emergencyRelation = null;
  if (!isBlank(body.emergencyRelation)) {
    emergencyRelation = asTrimmedString(body.emergencyRelation);
    if (!RELATIONS.includes(emergencyRelation)) errors.emergencyRelation = 'Таны хэн болохыг жагсаалтаас сонгоно уу';
  }

  let homeProvince = null;
  if (!isBlank(body.homeProvince)) {
    homeProvince = asTrimmedString(body.homeProvince);
    if (!PROVINCES.includes(homeProvince)) errors.homeProvince = 'Аймаг, хотоо жагсаалтаас сонгоно уу';
  }

  let courseYear = null;
  if (!isBlank(body.courseYear)) {
    courseYear = parseIntInRange(body.courseYear, 1, 6);
    if (Number.isNaN(courseYear)) errors.courseYear = 'Курсээ жагсаалтаас сонгоно уу';
  }

  let priorityTags = [];
  if (!isBlank(body.priorityTags)) {
    const tags = body.priorityTags;
    if (!Array.isArray(tags) || tags.length > Object.keys(PRIORITY_TAGS).length
      || !tags.every((t) => typeof t === 'string' && Object.hasOwn(PRIORITY_TAGS, t))) {
      errors.priorityTags = 'Давуу эрхийн ангиллыг жагсаалтаас сонгоно уу';
    } else {
      priorityTags = [...new Set(tags)];
    }
  }

  return result(errors, {
    dormId, phone, emergencyName, emergencyPhone, reason,
    emergencyRelation, homeProvince, courseYear, priorityTags,
  });
}

module.exports = { validateApplication, parseId, REASON_MIN, REASON_MAX };
