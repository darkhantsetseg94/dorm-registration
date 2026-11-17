const { AUDIENCE_LABELS } = require('../constants');
const {
  isPlainObject, isBlank, asTrimmedString, parsePositiveInt, parseIntInRange, parseBool,
  isValidDate, optionalText, requiredText, result,
} = require('./common');

const ROOM_NUMBER_RE = /^[A-Za-z0-9А-ЯӨҮа-яөү-]{1,10}$/;
const MAX_BULK_ROOMS = 500;

const noBody = () => ({ errors: { form: 'Өгөгдөл буруу байна' }, data: null });

function optionalRoomGender(body, errors) {
  if (isBlank(body.gender)) return null;
  if (!['male', 'female'].includes(body.gender)) errors.gender = 'Өрөөний хүйс буруу байна';
  return body.gender;
}

// ---------------- Байр ----------------
function validateDorm(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const name = requiredText(body, 'name', errors, { min: 2, max: 60, label: 'Байрны нэр' });
  if (!['male', 'female', 'mixed'].includes(body.genderType)) errors.genderType = 'Байрны төрлөө сонгоно уу';
  const capacity = parseIntInRange(body.capacity, 1, 5000);
  if (Number.isNaN(capacity)) errors.capacity = 'Багтаамж 1–5000 хооронд бүхэл тоо байна';
  const monthlyFee = isBlank(body.monthlyFee) ? 0 : parseIntInRange(body.monthlyFee, 0, 10000000);
  if (Number.isNaN(monthlyFee)) errors.monthlyFee = 'Төлбөр 0–10,000,000 төгрөгийн хооронд байна';
  const address = optionalText(body, 'address', errors, { max: 200, label: 'Хаяг' });
  const description = optionalText(body, 'description', errors, { max: 1000, label: 'Тайлбар' });
  let isActive = true;
  if (body.isActive !== undefined) {
    isActive = parseBool(body.isActive);
    if (isActive === null) errors.isActive = 'Төлөв буруу байна';
  }
  return result(errors, { name, genderType: body.genderType, capacity, monthlyFee, address, description, isActive });
}

// ---------------- Өрөө ----------------
function validateRoom(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const roomNumber = asTrimmedString(body.roomNumber);
  if (!roomNumber) errors.roomNumber = 'Өрөөний дугаар оруулна уу';
  else if (!ROOM_NUMBER_RE.test(roomNumber)) errors.roomNumber = 'Өрөөний дугаар 1–10 тэмдэгт (үсэг, тоо, зураас)';
  const floor = parseIntInRange(body.floor, 0, 30);
  if (Number.isNaN(floor)) errors.floor = 'Давхар 0–30 хооронд байна';
  const capacity = parseIntInRange(body.capacity, 1, 12);
  if (Number.isNaN(capacity)) errors.capacity = 'Орны тоо 1–12 хооронд байна';
  const gender = optionalRoomGender(body, errors);
  return result(errors, { roomNumber, floor, capacity, gender });
}

/** Олон өрөө нэг дор үүсгэх: 1–5 давхар, давхар бүрт 8 өрөө → 101…108, 201…208 */
function validateBulkRooms(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const floorFrom = parseIntInRange(body.floorFrom, 0, 30);
  const floorTo = parseIntInRange(body.floorTo, 0, 30);
  if (Number.isNaN(floorFrom)) errors.floorFrom = 'Давхар 0–30 хооронд байна';
  if (Number.isNaN(floorTo)) errors.floorTo = 'Давхар 0–30 хооронд байна';
  else if (!errors.floorFrom && floorTo < floorFrom) errors.floorTo = 'Эцсийн давхар эхнийхээс бага байж болохгүй';
  const roomsPerFloor = parseIntInRange(body.roomsPerFloor, 1, 50);
  if (Number.isNaN(roomsPerFloor)) errors.roomsPerFloor = 'Давхар бүрийн өрөө 1–50 хооронд байна';
  const capacity = parseIntInRange(body.capacity, 1, 12);
  if (Number.isNaN(capacity)) errors.capacity = 'Орны тоо 1–12 хооронд байна';
  const gender = optionalRoomGender(body, errors);
  if (Object.keys(errors).length === 0 && (floorTo - floorFrom + 1) * roomsPerFloor > MAX_BULK_ROOMS) {
    errors.roomsPerFloor = `Нэг удаад ${MAX_BULK_ROOMS}-аас ихгүй өрөө үүсгэнэ`;
  }
  return result(errors, { floorFrom, floorTo, roomsPerFloor, capacity, gender });
}

// ---------------- Хүсэлт шийдвэрлэх ----------------
function optionalRoomId(body, errors) {
  if (isBlank(body.roomId)) return null;
  const roomId = parsePositiveInt(body.roomId);
  if (Number.isNaN(roomId)) errors.roomId = 'Өрөөний сонголт буруу байна';
  return roomId;
}

function validateApprove(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const roomId = optionalRoomId(body, errors);
  const note = optionalText(body, 'note', errors, { max: 500, label: 'Тайлбар' });
  return result(errors, { roomId, note });
}

function validateReject(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const note = requiredText(body, 'note', errors, {
    min: 5, max: 500, label: 'Татгалзсан шалтгаан', emptyMessage: 'Татгалзсан шалтгааныг оюутанд тайлбарлана уу',
  });
  return result(errors, { note });
}

function validateRoomChange(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const roomId = optionalRoomId(body, errors);
  return result(errors, { roomId });
}

function validateReopen(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const note = optionalText(body, 'note', errors, { max: 500, label: 'Тайлбар' });
  return result(errors, { note });
}

// ---------------- Мэдээлэл ----------------
function validateAnnouncement(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const title = requiredText(body, 'title', errors, { min: 3, max: 120, label: 'Гарчиг' });
  const text = requiredText(body, 'body', errors, { min: 3, max: 3000, label: 'Агуулга' });
  const audience = body.audience === undefined ? 'all' : body.audience;
  if (!Object.hasOwn(AUDIENCE_LABELS, audience)) errors.audience = 'Хэнд харагдахыг сонгоно уу';
  const isPinned = body.isPinned === undefined ? false : parseBool(body.isPinned);
  if (isPinned === null) errors.isPinned = 'Буруу утга';
  return result(errors, { title, body: text, audience, isPinned });
}

// ---------------- Тохиргоо ----------------
function validateSettings(body) {
  if (!isPlainObject(body)) return noBody();
  const errors = {};
  const applicationsOpen = parseBool(body.applicationsOpen);
  if (applicationsOpen === null) errors.applicationsOpen = 'Буруу утга';
  const registrationOpen = parseBool(body.registrationOpen);
  if (registrationOpen === null) errors.registrationOpen = 'Буруу утга';

  const date = (key) => {
    if (isBlank(body[key])) return '';
    const text = asTrimmedString(body[key]);
    if (!text || !isValidDate(text)) errors[key] = 'Огноо буруу байна (ОООО-СС-ӨӨ)';
    return text;
  };
  const applicationStart = date('applicationStart');
  const applicationDeadline = date('applicationDeadline');
  if (!errors.applicationStart && !errors.applicationDeadline && applicationStart && applicationDeadline
    && applicationStart > applicationDeadline) {
    errors.applicationDeadline = 'Эцсийн хугацаа эхлэх огнооноос хойш байна';
  }
  return result(errors, { applicationsOpen, registrationOpen, applicationStart, applicationDeadline });
}

module.exports = {
  validateDorm,
  validateRoom,
  validateBulkRooms,
  validateApprove,
  validateReject,
  validateRoomChange,
  validateReopen,
  validateAnnouncement,
  validateSettings,
};
