const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { migrate } = require('./migrations');

/**
 * SQLite холболт үүсгэж, хүснэгтүүдийг хамгийн сүүлийн бүтэц рүү шинэчилнэ.
 * @param {string} file  өгөгдлийн сангийн файл (тестэд ':memory:')
 */
function createDatabase(file) {
  const inMemory = file === ':memory:';
  if (!inMemory) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  // SQLite-ийн LOWER() зөвхөн латин үсгийг жижигрүүлдэг тул кирилл хайлтад зориулсан функц
  db.function('lower_unicode', { deterministic: true }, (text) => (text == null ? null : String(text).toLowerCase()));
  if (!inMemory) {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
  }
  migrate(db);
  return db;
}

module.exports = { createDatabase };
