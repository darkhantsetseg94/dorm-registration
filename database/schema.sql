-- Оюутны дотуур байрны бүртгэлийн систем (US-01)

CREATE TABLE IF NOT EXISTS users (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,            -- оюутны код эсвэл ажилтны нэр
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                   -- зөвхөн bcrypt hash
  gender        TEXT    NOT NULL CHECK (gender IN ('male', 'female')),
  role          TEXT    NOT NULL CHECK (role IN ('student', 'staff')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dormitories (
  dorm_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  gender_type TEXT    NOT NULL CHECK (gender_type IN ('male', 'female', 'mixed')),
  capacity    INTEGER NOT NULL CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS applications (
  application_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  dorm_id         INTEGER NOT NULL REFERENCES dormitories (dorm_id),
  academic_year   TEXT    NOT NULL,                   -- жишээ: 2026-2027
  phone           TEXT    NOT NULL,
  emergency_name  TEXT    NOT NULL,
  emergency_phone TEXT    NOT NULL,
  reason          TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, academic_year)                  -- нэг жилд нэг хүсэлт
);
