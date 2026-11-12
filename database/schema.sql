-- Оюутны дотуур байрны бүртгэлийн систем (нэг байртай)
-- Лаб 5: US-01 хүсэлт илгээх · Лаб 11: CRUD (засах, цуцлах, ажилтан шийдвэрлэх)

-- Схемийн хувилбар. Бүтэц өөрчлөгдөх бүрд нэмэгдүүлж, src/db/database.js-ийн SCHEMA_VERSION-тэй тааруулна.
PRAGMA user_version = 3;

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

-- Дотуур байр нэг байртай тул хүсэлтэд байр сонгох талбар байхгүй.
CREATE TABLE IF NOT EXISTS applications (
  application_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  academic_year   TEXT    NOT NULL,                   -- жишээ: 2026-2027
  phone           TEXT    NOT NULL,
  emergency_name  TEXT    NOT NULL,
  emergency_phone TEXT    NOT NULL,
  reason          TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  review_note     TEXT,                               -- ажилтны тайлбар (татгалзсан шалтгаан)
  reviewed_by     INTEGER REFERENCES users (user_id),
  reviewed_at     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Нэг оюутан нэг хичээлийн жилд зөвхөн нэг идэвхтэй хүсэлттэй.
-- Цуцалсан (CANCELLED) хүсэлт тооцогдохгүй тул цуцалсны дараа дахин илгээх боломжтой.
CREATE UNIQUE INDEX IF NOT EXISTS ux_applications_active_per_year
  ON applications (student_id, academic_year)
  WHERE status <> 'CANCELLED';

CREATE INDEX IF NOT EXISTS ix_applications_status ON applications (status);
