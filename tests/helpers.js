const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');

const PASSWORD = 'Test@2026pass';

const USERS = {
  bat: { username: 'B221910001', full_name: 'Бат-Эрдэнэ Ганбаатар', email: 'bat@test.mn', gender: 'male', role: 'student' },
  saraa: { username: 'B221910002', full_name: 'Сарангэрэл Төмөрбаатар', email: 'saraa@test.mn', gender: 'female', role: 'student' },
  staff: { username: 'staff01', full_name: 'Дотуур байрны багш', email: 'staff@test.mn', gender: 'female', role: 'staff' },
  tuvshin: { username: 'B221910003', full_name: 'Түвшин Болд', email: 'tuvshin@test.mn', gender: 'male', role: 'student' },
  nomin: { username: 'B221910004', full_name: 'Номин Энхбаяр', email: 'nomin@test.mn', gender: 'female', role: 'student' },
};

const VALID_FORM = {
  dormId: 1,
  phone: '99112233',
  emergencyName: 'Ганбаатар Должин',
  emergencyPhone: '88112233',
  reason: 'Говь-Алтай аймгаас ирсэн, хотод хамаатан садангүй',
};

/**
 * Тест бүрт шинэ, тусгаарлагдсан in-memory өгөгдлийн сантай app үүсгэнэ.
 *
 * Байр:  1 — эрэгтэй (120), 2 — эмэгтэй (150), 3 — холимог (200)
 * Өрөө:  1-р байр: 101 (2 ор), 102 (3 ор)
 *        3-р байр: 301 (эрэгтэй, 2 ор), 302 (хүйс заагаагүй, 2 ор)
 */
function buildTestApp(options) {
  const db = createDatabase(':memory:');
  const hash = bcrypt.hashSync(PASSWORD, 4);
  const insertUser = db.prepare(
    `INSERT INTO users (username, full_name, email, password_hash, gender, role)
     VALUES (@username, @full_name, @email, @password_hash, @gender, @role)`
  );
  Object.values(USERS).forEach((u) => insertUser.run({ ...u, password_hash: hash }));

  const insertDorm = db.prepare('INSERT INTO dormitories (name, gender_type, capacity) VALUES (?, ?, ?)');
  insertDorm.run('1-р байр', 'male', 120);
  insertDorm.run('2-р байр', 'female', 150);
  insertDorm.run('3-р байр', 'mixed', 200);

  const insertRoom = db.prepare('INSERT INTO rooms (dorm_id, room_number, floor, capacity, gender) VALUES (?, ?, ?, ?, ?)');
  insertRoom.run(1, '101', 1, 2, null);
  insertRoom.run(1, '102', 1, 3, null);
  insertRoom.run(3, '301', 3, 2, 'male');
  insertRoom.run(3, '302', 3, 2, null);

  return { app: createApp(db, options), db };
}

/** Хэрэглэгчээр нэвтэрсэн supertest agent (cookie хадгална) буцаана. */
async function loginAs(app, key) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username: USERS[key].username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${key}: ${res.status}`);
  return agent;
}

/** ID-аар өрөө олох: roomId(db, 1, '101') */
function roomId(db, dormId, number) {
  return db.prepare('SELECT room_id FROM rooms WHERE dorm_id = ? AND room_number = ?').get(dormId, number).room_id;
}

/** Оюутнаар хүсэлт илгээгээд ID-г буцаана */
async function submit(agent, override = {}) {
  const res = await agent.post('/api/applications').send({ ...VALID_FORM, ...override });
  if (res.status !== 201) throw new Error(`Submit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.application.id;
}

module.exports = { buildTestApp, loginAs, roomId, submit, USERS, PASSWORD, VALID_FORM };
