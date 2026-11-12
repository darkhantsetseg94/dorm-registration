/**
 * Demo өгөгдөл: 2 оюутан, 1 ажилтан.
 * Ажиллуулах: npm run seed   (DEMO_PASSWORD-ийг .env-д тохируулсан байх)
 */
const bcrypt = require('bcryptjs');

const USERS = [
  { username: 'B221910001', fullName: 'Б. Тэмүүлэн', email: 'b221910001@student.edu.mn', gender: 'male', role: 'student' },
  { username: 'B221910002', fullName: 'Д. Номин', email: 'b221910002@student.edu.mn', gender: 'female', role: 'student' },
  { username: 'staff01', fullName: 'Г. Сарантуяа', email: 'staff01@edu.mn', gender: 'female', role: 'staff' },
];

/**
 * Өгөгдлийн санд demo хэрэглэгчдийг оруулна. Хэрэглэгч бүрт тусдаа salt-тай hash үүсгэнэ.
 */
function seedDemo(db, password, rounds = 10) {
  if (!password) throw new Error('Demo нууц үг өгөгдөөгүй байна');

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (username, full_name, email, password_hash, gender, role)
     VALUES (@username, @fullName, @email, @passwordHash, @gender, @role)`
  );

  db.transaction(() => {
    for (const u of USERS) {
      insertUser.run({ ...u, passwordHash: bcrypt.hashSync(password, rounds) });
    }
  })();
}

module.exports = { seedDemo, USERS };

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
