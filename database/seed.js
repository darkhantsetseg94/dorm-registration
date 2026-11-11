/**
 * Demo өгөгдөл: 3 байр, 2 оюутан, 1 ажилтан.
 * Ажиллуулах: npm run seed   (DEMO_PASSWORD-ийг .env-д тохируулсан байх)
 */
const bcrypt = require('bcryptjs');

const DORMITORIES = [
  { name: '1-р байр', genderType: 'male', capacity: 120 },
  { name: '2-р байр', genderType: 'female', capacity: 150 },
  { name: '3-р байр', genderType: 'mixed', capacity: 80 },
];

const USERS = [
  { username: 'B221910001', fullName: 'Б. Тэмүүлэн', email: 'b221910001@student.edu.mn', gender: 'male', role: 'student' },
  { username: 'B221910002', fullName: 'Д. Номин', email: 'b221910002@student.edu.mn', gender: 'female', role: 'student' },
  { username: 'staff01', fullName: 'Г. Сарантуяа', email: 'staff01@edu.mn', gender: 'female', role: 'staff' },
];

/**
 * Өгөгдлийн санд demo өгөгдөл оруулна. Хэрэглэгч бүрт тусдаа salt-тай hash үүсгэнэ.
 */
function seedDemo(db, password, rounds = 10) {
  if (!password) throw new Error('Demo нууц үг өгөгдөөгүй байна');

  const insertDorm = db.prepare(
    'INSERT OR IGNORE INTO dormitories (name, gender_type, capacity) VALUES (?, ?, ?)'
  );
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (username, full_name, email, password_hash, gender, role)
     VALUES (@username, @fullName, @email, @passwordHash, @gender, @role)`
  );

  db.transaction(() => {
    for (const d of DORMITORIES) insertDorm.run(d.name, d.genderType, d.capacity);
    for (const u of USERS) {
      insertUser.run({ ...u, passwordHash: bcrypt.hashSync(password, rounds) });
    }
  })();
}

module.exports = { seedDemo, DORMITORIES, USERS };

if (require.main === module) {
  const config = require('../src/config');
  const { createDatabase } = require('../src/db/database');
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error('DEMO_PASSWORD орчны хувьсагчийг .env файлд тохируулна уу');
    process.exit(1);
  }
  const db = createDatabase(config.dbFile);
  seedDemo(db, password, config.bcryptRounds);
  console.log(`Demo өгөгдөл үүслээ: ${config.dbFile}`);
  console.log('Хэрэглэгч: B221910001 (эрэгтэй оюутан), B221910002 (эмэгтэй оюутан), staff01 (ажилтан)');
  db.close();
}
