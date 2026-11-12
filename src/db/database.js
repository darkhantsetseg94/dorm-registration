const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', 'schema.sql');
const SCHEMA_VERSION = 3; // database/schema.sql доторх PRAGMA user_version-тэй ижил

/**
 * Өмнөх бүтэцтэй (жишээ нь олон байртай, dorm_id баганатай) өгөгдлийн сан эсэхийг шалгана.
 */
function isOutdated(db) {
  const hasTables = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'applications'"
  ).get();
  return Boolean(hasTables) && db.pragma('user_version', { simple: true }) !== SCHEMA_VERSION;
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

module.exports = { createDatabase, SCHEMA_VERSION };
