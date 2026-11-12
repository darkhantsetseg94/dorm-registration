const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', 'schema.sql');

/**
 * Лаб 5-ын хуучин бүтэцтэй (updated_at баганагүй) өгөгдлийн сан эсэхийг шалгана.
 */
function isOutdated(db) {
  const columns = db.prepare('PRAGMA table_info(applications)').all().map((c) => c.name);
  return columns.length > 0 && !columns.includes('updated_at');
}

/**
 * SQLite холболт нээж, хүснэгтүүдийг үүсгэнэ.
 * @param {string} filename  файлын зам эсвэл ':memory:' (тестэд)
 */
function createDatabase(filename = ':memory:') {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');

  if (isOutdated(db)) {
    db.close();
    throw new Error(
      `Өгөгдлийн сан (${filename}) хуучин бүтэцтэй байна. `
      + 'data хавтсыг устгаад "npm run seed"-ийг дахин ажиллуулна уу.'
    );
  }
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

module.exports = { createDatabase };
