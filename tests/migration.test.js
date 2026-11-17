const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { createDatabase } = require('../src/db/database');
const { SCHEMA_VERSION } = require('../src/db/migrations');

// Лабораторийн ажил 5-ын анхны schema (v1)
const V1_SCHEMA = `
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')), role TEXT NOT NULL CHECK (role IN ('student', 'staff')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE dormitories (
  dorm_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  gender_type TEXT NOT NULL CHECK (gender_type IN ('male', 'female', 'mixed')), capacity INTEGER NOT NULL CHECK (capacity > 0));
CREATE TABLE applications (
  application_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  dorm_id INTEGER NOT NULL REFERENCES dormitories (dorm_id), academic_year TEXT NOT NULL, phone TEXT NOT NULL,
  emergency_name TEXT NOT NULL, emergency_phone TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (student_id, academic_year));
CREATE INDEX idx_applications_student ON applications (student_id);
INSERT INTO users (username, full_name, email, password_hash, gender, role)
  VALUES ('B221910001', 'Бат-Эрдэнэ Ганбаатар', 'b@x.mn', '$2b$10$hash', 'male', 'student');
INSERT INTO dormitories (name, gender_type, capacity) VALUES ('1-р байр', 'male', 120);
INSERT INTO applications (student_id, dorm_id, academic_year, phone, emergency_name, emergency_phone, reason)
  VALUES (1, 1, '2026-2027', '99112233', 'Ганбаатар Должин', '88112233', 'Орон нутгаас ирсэн оюутан');
`;

describe('Өгөгдлийн сангийн migration', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odb-migration-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('TC60: Хуучин (v1) өгөгдлийн сан өгөгдөл алдалгүй v2 болно', () => {
    const file = path.join(dir, 'old.db');
    const old = new Database(file);
    old.exec(V1_SCHEMA);
    old.close();

    const db = createDatabase(file);
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(db.pragma('foreign_key_check')).toEqual([]);

    const app = db.prepare('SELECT * FROM applications').get();
    expect(app).toMatchObject({ application_id: 1, status: 'PENDING', room_id: null, priority_tags: '' });
    expect(db.prepare('SELECT action FROM application_events').all()).toEqual([{ action: 'SUBMITTED' }]);
    expect(db.prepare('SELECT is_active, monthly_fee FROM dormitories').get()).toEqual({ is_active: 1, monthly_fee: 0 });

    // Шинэ төлөв, шинэ хүснэгт ажиллана
    db.prepare("UPDATE applications SET status = 'CANCELLED'").run();
    db.prepare("INSERT INTO rooms (dorm_id, room_number, floor, capacity) VALUES (1, '101', 1, 3)").run();
    db.close();

    // Дахин нээхэд migration давтагдахгүй
    const again = createDatabase(file);
    expect(again.prepare('SELECT COUNT(*) AS n FROM application_events').get().n).toBe(1);
    again.close();
  });

  test('TC61: Шинэ болон шинэчилсэн өгөгдлийн сангийн бүтэц ижил', () => {
    const columns = (db) => db.prepare(
      "SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' ORDER BY t, c"
    ).all();
    const indexes = (db) => db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();

    const fresh = createDatabase(':memory:');
    const file = path.join(dir, 'old.db');
    const old = new Database(file);
    old.exec(V1_SCHEMA);
    old.close();
    const upgraded = createDatabase(file);

    expect(columns(upgraded)).toEqual(columns(fresh));
    expect(indexes(upgraded)).toEqual(indexes(fresh));
    upgraded.close();
  });
});
