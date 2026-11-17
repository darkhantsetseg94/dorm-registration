/**
 * Хөтөч дээрх шалгалт — серверийн validator-тай ижил дүрэм.
 * Хэрэглэгчид алдааг шууд харуулахад зориулсан; сервер дахин шалгана.
 * Функц бүр алдаатай бол мессеж, зөв бол null буцаана.
 */
const PHONE_RE = /^[6-9]\d{7}$/;
const NAME_RE = /^[A-Za-zА-ЯЁӨҮа-яёөү .-]{2,60}$/;
const HTML_RE = /<[^>]*>|javascript:/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const STUDENT_CODE_RE = /^[A-Z]{1,2}\d{6,10}$/;

export const rules = {
  phone(value, empty = 'Утасны дугаараа оруулна уу') {
    if (!value) return empty;
    return PHONE_RE.test(value) ? null : 'Утасны дугаар 8 оронтой байх ёстой (жишээ: 99112233)';
  },
  name(value, empty = 'Нэрээ оруулна уу') {
    if (!value) return empty;
    return NAME_RE.test(value) ? null : 'Нэр зөвхөн үсгээс бүрдэх ёстой (2–60 тэмдэгт)';
  },
  email(value) {
    if (!value) return 'Имэйл хаягаа оруулна уу';
    return EMAIL_RE.test(value) && value.length <= 120 ? null : 'Имэйл хаяг буруу байна (жишээ: ner@stud.edu.mn)';
  },
  studentCode(value) {
    if (!value) return 'Оюутны кодоо оруулна уу';
    return STUDENT_CODE_RE.test(value) ? null : 'Оюутны код буруу байна (жишээ: B221910001)';
  },
  password(value) {
    if (!value) return 'Нууц үгээ оруулна уу';
    if (value.length < 8) return 'Нууц үг дор хаяж 8 тэмдэгт байна';
    if (!/[A-Za-zА-Яа-яЁёӨөҮү]/.test(value) || !/\d/.test(value)) return 'Нууц үг үсэг болон тоо агуулсан байна';
    return null;
  },
  text(value, { min, max, label, empty }) {
    if (!value) return empty || `${label} оруулна уу`;
    if (HTML_RE.test(value)) return 'HTML код болон тусгай тэмдэгт оруулах боломжгүй';
    if (value.length < min || value.length > max) return `${label} ${min}–${max} тэмдэгт байх ёстой`;
    return null;
  },
};

/** { field: message|null } → зөвхөн алдаатай талбарууд, эсвэл null */
export function collectErrors(map) {
  const errors = Object.fromEntries(Object.entries(map).filter(([, v]) => v));
  return Object.keys(errors).length ? errors : null;
}
