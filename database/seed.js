/**
 * Demo өгөгдөл оруулах скрипт:
 *   npm run seed       байр, өрөө, хэрэглэгч, жишээ хүсэлтүүдийг нэмнэ (дахин ажиллуулахад давхардахгүй)
 *   npm run db:reset   өгөгдлийн санг бүрэн устгаад шинээр seed хийнэ
 *
 * Нууц үгийг .env-ийн DEMO_PASSWORD-оос уншина (код дотор бичихгүй).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { createDatabase } = require('../src/db/database');
const { currentAcademicYear, previousAcademicYear } = require('../src/utils/time');

const password = process.env.DEMO_PASSWORD;
if (!password) {
  console.error('DEMO_PASSWORD орчны хувьсагч тохируулагдаагүй байна.');
  process.exit(1);
}

if (process.argv.includes('--reset')) {
  ['', '-wal', '-shm'].forEach((suffix) => {
    const file = path.resolve(`${config.dbFile}${suffix}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
  console.log(`Өгөгдлийн санг устгалаа: ${config.dbFile}`);
}

const db = createDatabase(config.dbFile);
const year = currentAcademicYear();
const lastYear = previousAcademicYear(year);

// ---------------- Байр, өрөө ----------------
// Манай сургууль нэг дотуур байртай. Байр холимог бөгөөд хүйсийг давхраар салгана:
// 1–2 давхарт эрэгтэй, 3–4 давхарт эмэгтэй, 5-р давхрын өрөөнд хүйсийг ажилтан хуваарилахдаа тогтооно.
const DORM = 'Оюутны дотуур байр';
const dorms = [
  {
    name: DORM, gender_type: 'mixed', capacity: 240, monthly_fee: 95000,
    address: 'Баянзүрх дүүрэг, Их сургуулийн гудамж 3',
    description: 'Таван давхар, дөрвөн ортой өрөөтэй. 1–2 давхарт эрэгтэй, 3–4 давхарт эмэгтэй оюутан байрлана. '
      + 'Давхар бүрт гал тогоо, угаалгын өрөөтэй, 24 цагийн жижүүртэй.',
    rooms: { floors: [1, 5], perFloor: 12, beds: 4, gender: (floor) => ({ 1: 'male', 2: 'male', 3: 'female', 4: 'female' }[floor] || null) },
  },
];

// ---------------- Хэрэглэгчид ----------------
// [код, нэр, хүйс, аймаг, курс]
const DEMO_STUDENTS = [
  ['B221910003', 'Тэмүүлэн Батбаяр', 'male', 'Хөвсгөл', 2],
  ['B221910004', 'Номин Энхбаяр', 'female', 'Баянхонгор', 1],
  ['B221910005', 'Төгөлдөр Мөнхбат', 'male', 'Увс', 1],
  ['B221910006', 'Солонго Батсүх', 'female', 'Дундговь', 2],
  ['B221910007', 'Билгүүн Отгонбаяр', 'male', 'Завхан', 3],
  ['B221910008', 'Мишээл Ганболд', 'female', 'Өмнөговь', 1],
  ['B221910009', 'Анар Ганзориг', 'male', 'Ховд', 1],
  ['B221910010', 'Ариунзаяа Мөнхжаргал', 'female', 'Хөвсгөл', 3],
  ['B221910011', 'Мөнх-Очир Батжаргал', 'male', 'Дорнод', 2],
  ['B221910012', 'Хулан Цогтбаатар', 'female', 'Сүхбаатар', 2],
  ['B221910013', 'Ганбат Энхтөр', 'male', 'Өвөрхангай', 4],
  ['B221910014', 'Анужин Бямбасүрэн', 'female', 'Дорноговь', 1],
  ['B221910015', 'Сүхбат Нямдорж', 'male', 'Говь-Алтай', 1],
  ['B221910016', 'Марал Сайнбаяр', 'female', 'Булган', 4],
  ['B221910017', 'Ерлан Серик', 'male', 'Баян-Өлгий', 2],
  ['B221910018', 'Уянга Даваасүрэн', 'female', 'Архангай', 1],
  ['B221910019', 'Өсөхбаяр Цэрэндорж', 'male', 'Архангай', 3],
  ['B221910020', 'Гэрэлмаа Эрдэнэбилэг', 'female', 'Улаанбаатар', 2],
  ['B221910021', 'Оргил Түвшинбаяр', 'male', 'Улаанбаатар', 1],
  ['B221910022', 'Нандин-Эрдэнэ Ганбаяр', 'female', 'Увс', 1],
  ['B221910023', 'Тамир Ганхуяг', 'male', 'Сэлэнгэ', 2],
  ['B221910024', 'Дэлгэрмаа Түмэнжаргал', 'female', 'Завхан', 3],
  ['B221910025', 'Дөлгөөн Баасанжав', 'male', 'Хэнтий', 1],
  ['B221910026', 'Энхжин Батболд', 'female', 'Говьсүмбэр', 2],
];

const users = [
  { username: 'B221910001', full_name: 'Бат-Эрдэнэ Ганбаатар', email: 'b221910001@stud.edu.mn', gender: 'male', role: 'student', phone: null },
  { username: 'B221910002', full_name: 'Сарангэрэл Төмөрбаатар', email: 'b221910002@stud.edu.mn', gender: 'female', role: 'student', phone: null },
  { username: 'staff01', full_name: 'Дотуур байрны багш', email: 'staff01@odb.edu.mn', gender: 'female', role: 'staff', phone: '70112233' },
  ...DEMO_STUDENTS.map(([username, fullName, gender], i) => ({
    username, full_name: fullName, email: `${username.toLowerCase()}@stud.edu.mn`, gender, role: 'student',
    phone: String(99000000 + (i + 1) * 13579).slice(0, 8),
  })),
];

// ---------------- Жишээ хүсэлтүүд ----------------
// [код, байр, төлөв, өрөө, хоногийн өмнө, давуу эрх, шалтгаан]
const REASONS = {
  rural: 'Орон нутгаас ирсэн, хотод хамаатан садангүй тул байр түрээслэх боломжгүй.',
  family: 'Гэр бүл маань хөдөө амьдардаг, хотод түрээсийн байрны төлбөр өндөр байна.',
  study: 'Хичээл орой болтол үргэлжилдэг, гэрээс сургууль хүртэл 2 цаг явдаг.',
  income: 'Ар гэрийн орлого бага, олон хүүхэдтэй өрхийн хүүхэд.',
};
const SAMPLE_APPLICATIONS = [
  ['B221910003', DORM, 'APPROVED', '201', 17, ['rural'], REASONS.rural],
  ['B221910005', DORM, 'APPROVED', '201', 16, ['rural', 'low_income'], REASONS.income],
  ['B221910007', DORM, 'APPROVED', '202', 16, ['rural', 'excellence'], REASONS.rural],
  ['B221910009', DORM, 'APPROVED', '101', 15, ['rural'], REASONS.family],
  ['B221910011', DORM, 'APPROVED', null, 12, ['rural'], REASONS.family],
  ['B221910004', DORM, 'APPROVED', '301', 17, ['rural', 'many_children'], REASONS.income],
  ['B221910006', DORM, 'APPROVED', '301', 14, ['rural'], REASONS.rural],
  ['B221910008', DORM, 'APPROVED', '301', 13, ['rural', 'orphan'], REASONS.rural],
  ['B221910010', DORM, 'APPROVED', '302', 11, ['excellence'], REASONS.study],
  ['B221910012', DORM, 'APPROVED', null, 9, ['rural'], REASONS.family],
  ['B221910013', DORM, 'REJECTED', null, 10, [], 'Хотод амьдардаг ч сургууль хол байдаг тул байранд суух хүсэлтэй.'],
  ['B221910014', DORM, 'PENDING', null, 6, ['rural', 'low_income'], REASONS.income],
  ['B221910015', DORM, 'PENDING', null, 5, ['rural', 'disability'], REASONS.rural],
  ['B221910016', DORM, 'PENDING', null, 5, [], REASONS.study],
  ['B221910017', DORM, 'PENDING', null, 4, ['rural'], REASONS.rural],
  ['B221910018', DORM, 'PENDING', null, 3, ['rural', 'many_children'], REASONS.family],
  ['B221910019', DORM, 'PENDING', null, 3, ['rural'], REASONS.family],
  ['B221910020', DORM, 'REJECTED', null, 8, [], 'Сургуулийн ойролцоо байранд амьдрахыг хүсэж байна.'],
  ['B221910021', DORM, 'CANCELLED', null, 7, [], REASONS.study],
  ['B221910022', DORM, 'PENDING', null, 2, ['rural', 'orphan'], REASONS.rural],
  ['B221910023', DORM, 'PENDING', null, 1, ['rural'], REASONS.rural],
  ['B221910024', DORM, 'PENDING', null, 1, ['excellence'], REASONS.family],
  ['B221910025', DORM, 'PENDING', null, 0, ['rural', 'low_income'], REASONS.income],
];
// Өмнөх жилийн түүх
const LAST_YEAR = [
  ['B221910007', DORM, 'APPROVED', '105'],
  ['B221910010', DORM, 'APPROVED', '304'],
  ['B221910013', DORM, 'APPROVED', '108'],
];
const EMERGENCY = [
  ['Батбаяр Должин', 'Эх'], ['Энхбаяр Ганбат', 'Эцэг'], ['Мөнхбат Сарнай', 'Эх'],
  ['Батсүх Оюун', 'Эх'], ['Отгонбаяр Бат', 'Эцэг'], ['Ганболд Цэцэг', 'Эх'],
];
const REJECT_NOTE = 'Улаанбаатар хотод байнгын оршин суудаг тул энэ удаад орон нутгийн оюутанд давуу эрх олголоо.';

const insert = {
  dorm: db.prepare(
    `INSERT OR IGNORE INTO dormitories (name, gender_type, capacity, address, description, monthly_fee)
     VALUES (@name, @gender_type, @capacity, @address, @description, @monthly_fee)`
  ),
  room: db.prepare(
    'INSERT OR IGNORE INTO rooms (dorm_id, room_number, floor, capacity, gender) VALUES (?, ?, ?, ?, ?)'
  ),
  user: db.prepare(
    `INSERT OR IGNORE INTO users (username, full_name, email, phone, password_hash, gender, role)
     VALUES (@username, @full_name, @email, @phone, @password_hash, @gender, @role)`
  ),
  application: db.prepare(
    `INSERT INTO applications (student_id, dorm_id, room_id, academic_year, phone, emergency_name, emergency_phone,
       emergency_relation, home_province, course_year, priority_tags, reason, status, staff_note, reviewed_by,
       reviewed_at, created_at, updated_at)
     VALUES (@studentId, @dormId, @roomId, @year, @phone, @emergencyName, @emergencyPhone, @relation, @province,
       @course, @tags, @reason, @status, @note, @reviewedBy, @reviewedAt, @createdAt, @createdAt)`
  ),
  event: db.prepare(
    'INSERT INTO application_events (application_id, actor_id, action, note, created_at) VALUES (?, ?, ?, ?, ?)'
  ),
  notification: db.prepare(
    "INSERT INTO notifications (user_id, title, body, link, created_at) VALUES (?, ?, ?, '/dashboard.html', ?)"
  ),
  setting: db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'),
  announcement: db.prepare(
    `INSERT INTO announcements (title, body, audience, is_pinned, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))`
  ),
};
const find = {
  dorm: db.prepare('SELECT dorm_id FROM dormitories WHERE name = ?'),
  room: db.prepare('SELECT room_id FROM rooms WHERE dorm_id = ? AND room_number = ?'),
  user: db.prepare('SELECT user_id, phone FROM users WHERE username = ?'),
  hasApplications: db.prepare('SELECT COUNT(*) AS n FROM applications WHERE student_id = ?'),
};

/** "N хоногийн өмнө, H цагт" → SQLite UTC текст */
const ago = db.prepare("SELECT datetime('now', ?, ?) AS t");
const timeAgo = (days, hours = 0) => ago.get(`-${days} days`, `-${hours} hours`).t;

let applicationCount = 0;

db.transaction(() => {
  // Байр, өрөө
  dorms.forEach((d) => {
    insert.dorm.run(d);
    const dormId = find.dorm.get(d.name).dorm_id;
    for (let floor = d.rooms.floors[0]; floor <= d.rooms.floors[1]; floor += 1) {
      for (let i = 1; i <= d.rooms.perFloor; i += 1) {
        const gender = d.rooms.gender ? d.rooms.gender(floor) : null;
        insert.room.run(dormId, `${floor}${String(i).padStart(2, '0')}`, floor, d.rooms.beds, gender);
      }
    }
  });

  // Хэрэглэгчид — хэрэглэгч бүрт тусдаа salt үүсгэнэ, ижил нууц үгтэй ч hash нь өөр байна
  users.forEach((u) => insert.user.run({ ...u, password_hash: bcrypt.hashSync(password, config.bcryptRounds) }));
  const staffId = find.user.get('staff01').user_id;

  // Тохиргоо (анхны утга)
  [['applications_open', '1'], ['registration_open', '1'], ['application_start', ''], ['application_deadline', '']]
    .forEach(([k, v]) => insert.setting.run(k, v));

  const studentInfo = Object.fromEntries(DEMO_STUDENTS.map(([code, , , province, course]) => [code, { province, course }]));

  function addApplication(code, dormName, status, roomNumber, academicYear, daysAgo, tags, reason, index) {
    const student = find.user.get(code);
    const dormId = find.dorm.get(dormName).dorm_id;
    const room = roomNumber ? find.room.get(dormId, roomNumber) : null;
    const [emergencyName, relation] = EMERGENCY[index % EMERGENCY.length];
    const createdAt = timeAgo(daysAgo, index % 9);
    const reviewedAt = status === 'APPROVED' || status === 'REJECTED' ? timeAgo(Math.max(daysAgo - 2, 0), 0) : null;
    const note = status === 'REJECTED' ? REJECT_NOTE : null;

    const id = insert.application.run({
      studentId: student.user_id, dormId, roomId: room ? room.room_id : null, year: academicYear,
      phone: student.phone, emergencyName, emergencyPhone: String(88000000 + index * 7919).slice(0, 8), relation,
      province: studentInfo[code].province, course: studentInfo[code].course, tags: tags.join(','), reason,
      status, note, reviewedBy: reviewedAt ? staffId : null, reviewedAt, createdAt,
    }).lastInsertRowid;

    insert.event.run(id, student.user_id, 'SUBMITTED', null, createdAt);
    if (status === 'CANCELLED') insert.event.run(id, student.user_id, 'CANCELLED', null, timeAgo(daysAgo - 1));
    if (status === 'APPROVED') {
      insert.event.run(id, staffId, 'APPROVED', null, reviewedAt);
      if (room) insert.event.run(id, staffId, 'ROOM_ASSIGNED', `${roomNumber} тоот өрөө`, reviewedAt);
      if (academicYear === year) {
        insert.notification.run(student.user_id, 'Таны хүсэлт зөвшөөрөгдлөө',
          room ? `${dormName}, ${roomNumber} тоот өрөө.` : `${dormName}. Өрөөг удахгүй хуваарилна.`, reviewedAt);
      }
    }
    if (status === 'REJECTED') {
      insert.event.run(id, staffId, 'REJECTED', note, reviewedAt);
      insert.notification.run(student.user_id, 'Таны хүсэлтээс татгалзлаа', note, reviewedAt);
    }
    applicationCount += 1;
  }

  // Өмнө нь хүсэлттэй оюутанд дахин хүсэлт нэмэхгүй (seed-г олон удаа ажиллуулж болно)
  const fresh = (code) => find.hasApplications.get(find.user.get(code).user_id).n === 0;
  const freshCodes = new Set(DEMO_STUDENTS.map(([code]) => code).filter(fresh));

  LAST_YEAR.forEach(([code, dormName, status, room], i) => {
    if (freshCodes.has(code)) addApplication(code, dormName, status, room, lastYear, 330 + i, ['rural'], REASONS.rural, i);
  });
  SAMPLE_APPLICATIONS.forEach(([code, dormName, status, room, daysAgo, tags, reason], i) => {
    if (freshCodes.has(code)) addApplication(code, dormName, status, room, year, daysAgo, tags, reason, i);
  });

  // Мэдээлэл
  if (db.prepare('SELECT COUNT(*) AS n FROM announcements').get().n === 0) {
    insert.announcement.run(
      `${year} оны дотуур байрны хүсэлт хүлээн авч байна`,
      'Хүсэлтээ системээр илгээнэ үү. Орон нутгаас ирсэн, нийгмийн эмзэг бүлгийн оюутанд давуу эрх олгоно. '
        + 'Зөвшөөрөгдсөн оюутан өрөөнийхөө дугаарыг хянах самбараас харна.',
      'student', 1, staffId, '-18 days', '-18 days'
    );
    insert.announcement.run(
      'Байранд орох үед авчрах бичиг баримт',
      'Иргэний үнэмлэх, оюутны үнэмлэх, 3x4 хэмжээтэй 2 зураг, эрүүл мэндийн хуудас. '
        + 'Эхний сарын төлбөрийг байранд орохоос өмнө төлнө.',
      'student', 0, staffId, '-6 days', '-6 days'
    );
    insert.announcement.run(
      'Өрөө хуваарилах журам',
      'Дотуур байрны 1–2 давхарт эрэгтэй, 3–4 давхарт эмэгтэй оюутан байрлана. '
        + 'Хагас дүүрсэн өрөөг эхэлж дүүргэнэ.',
      'staff', 0, staffId, '-10 days', '-10 days'
    );
  }
})();

const roomCount = db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n;
console.log(`Seed амжилттай: ${dorms.length} байр (${DORM}), ${roomCount} өрөө, ${users.length} хэрэглэгч, `
  + `${applicationCount} жишээ хүсэлт → ${config.dbFile}`);
db.close();
