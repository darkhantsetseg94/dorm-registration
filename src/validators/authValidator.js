const {
  USERNAME_RE, STUDENT_CODE_RE, NAME_RE, EMAIL_RE, PHONE_RE, PASSWORD_MAX,
  isPlainObject, asTrimmedString, isBlank, passwordProblem, result,
} = require('./common');

/**
 * Нэвтрэх хүсэлтийн input-ийг шалгана.
 * Хоосон бол → 'empty', формат буруу бол → 'invalid', зөв бол → null.
 */
function checkLoginInput(body) {
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) return { problem: 'empty' };
  if (!USERNAME_RE.test(username) || password.length > PASSWORD_MAX) {
    return { problem: 'invalid' };
  }
  return { problem: null, username, password };
}

function checkEmail(body, errors) {
  const email = asTrimmedString(body.email)?.toLowerCase();
  if (!email) errors.email = 'Имэйл хаягаа оруулна уу';
  else if (email.length > 120 || !EMAIL_RE.test(email)) errors.email = 'Имэйл хаяг буруу байна (жишээ: ner@stud.edu.mn)';
  return email;
}

function checkOptionalPhone(body, errors) {
  if (isBlank(body.phone)) return null;
  const phone = asTrimmedString(body.phone);
  if (!phone || !PHONE_RE.test(phone)) errors.phone = 'Утасны дугаар 8 оронтой байх ёстой (жишээ: 99112233)';
  return phone;
}

function checkFullName(body, errors) {
  const fullName = asTrimmedString(body.fullName)?.replace(/\s+/g, ' ');
  if (!fullName) errors.fullName = 'Овог нэрээ оруулна уу';
  else if (!NAME_RE.test(fullName)) errors.fullName = 'Нэр зөвхөн үсгээс бүрдэх ёстой (2–60 тэмдэгт)';
  return fullName;
}

function checkNewPassword(body, errors, key = 'password', confirmKey = 'passwordConfirm') {
  const password = typeof body[key] === 'string' ? body[key] : '';
  const problem = passwordProblem(password);
  if (problem) errors[key] = problem;
  else if (body[confirmKey] !== password) errors[confirmKey] = 'Нууц үг таарахгүй байна';
  return password;
}

/** Оюутан өөрөө бүртгүүлэх form */
function validateRegistration(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};

  const username = asTrimmedString(body.username)?.toUpperCase();
  if (!username) errors.username = 'Оюутны кодоо оруулна уу';
  else if (!STUDENT_CODE_RE.test(username)) errors.username = 'Оюутны код буруу байна (жишээ: B221910001)';

  const fullName = checkFullName(body, errors);
  const email = checkEmail(body, errors);
  const phone = checkOptionalPhone(body, errors);

  if (!['male', 'female'].includes(body.gender)) errors.gender = 'Хүйсээ сонгоно уу';
  const password = checkNewPassword(body, errors);

  return result(errors, { username, fullName, email, phone, gender: body.gender, password });
}

/** Профайл засах: имэйл, утас */
function validateProfileUpdate(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};
  const email = checkEmail(body, errors);
  const phone = checkOptionalPhone(body, errors);
  return result(errors, { email, phone });
}

/** Нууц үг солих */
function validatePasswordChange(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (!currentPassword) errors.currentPassword = 'Одоогийн нууц үгээ оруулна уу';
  const newPassword = checkNewPassword(body, errors, 'newPassword', 'newPasswordConfirm');
  if (!errors.newPassword && currentPassword && newPassword === currentPassword) {
    errors.newPassword = 'Шинэ нууц үг хуучнаасаа өөр байна';
  }
  return result(errors, { currentPassword, newPassword });
}

/** Ажилтан шинэ хэрэглэгч үүсгэх */
function validateUserCreate(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};

  const role = body.role;
  if (!['student', 'staff'].includes(role)) errors.role = 'Эрхээ сонгоно уу';

  let username = asTrimmedString(body.username);
  if (!username) errors.username = 'Нэвтрэх нэр оруулна уу';
  else if (role === 'student') {
    username = username.toUpperCase();
    if (!STUDENT_CODE_RE.test(username)) errors.username = 'Оюутны код буруу байна (жишээ: B221910001)';
  } else if (!USERNAME_RE.test(username)) {
    errors.username = 'Нэвтрэх нэр 3–20 тэмдэгт (латин үсэг, тоо, _) байна';
  }

  const fullName = checkFullName(body, errors);
  const email = checkEmail(body, errors);
  const phone = checkOptionalPhone(body, errors);
  if (!['male', 'female'].includes(body.gender)) errors.gender = 'Хүйсээ сонгоно уу';
  const password = checkNewPassword(body, errors);

  return result(errors, { role, username, fullName, email, phone, gender: body.gender, password });
}

/** Ажилтан хэрэглэгчийн мэдээлэл засах */
function validateUserUpdate(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};
  const fullName = checkFullName(body, errors);
  const email = checkEmail(body, errors);
  const phone = checkOptionalPhone(body, errors);
  if (!['male', 'female'].includes(body.gender)) errors.gender = 'Хүйсээ сонгоно уу';
  if (typeof body.isActive !== 'boolean') errors.isActive = 'Төлөв буруу байна';
  return result(errors, { fullName, email, phone, gender: body.gender, isActive: body.isActive });
}

/** Ажилтан нууц үг шинэчлэх */
function validatePasswordReset(body) {
  if (!isPlainObject(body)) return { errors: { form: 'Өгөгдөл буруу байна' }, data: null };
  const errors = {};
  const password = checkNewPassword(body, errors);
  return result(errors, { password });
}

module.exports = {
  checkLoginInput,
  validateRegistration,
  validateProfileUpdate,
  validatePasswordChange,
  validateUserCreate,
  validateUserUpdate,
  validatePasswordReset,
};
