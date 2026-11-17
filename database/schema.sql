-- ОДБ системийн өгөгдлийн сангийн бүтэц (schema v2)
--
-- Хамаарал:
--   users (1) ──< applications (N)          нэг оюутан олон жилд хүсэлт илгээж болно
--   dormitories (1) ──< rooms (N)           нэг байр олон өрөөтэй
--   dormitories (1) ──< applications (N)    нэг байранд олон хүсэлт ирнэ
--   rooms (1) ──< applications (N)          зөвшөөрөгдсөн оюутныг өрөөнд хуваарилна
--   applications (1) ──< application_events (N)   хүсэлтийн түүх (timeline)
--   users (1) ──< notifications (N)         оюутанд очих мэдэгдэл
--
-- Шинэ өгөгдлийн санд энэ файлыг бүтнээр нь ажиллуулна.
-- Хуучин (v1) өгөгдлийн санг src/db/migrations.js автоматаар шинэчилнэ.

CREATE TABLE IF NOT EXISTS users (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,              -- оюутны код / ажилтны нэвтрэх нэр
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                     -- bcrypt hash (plaintext хадгалахгүй)
  gender        TEXT    NOT NULL CHECK (gender IN ('male', 'female')),
  role          TEXT    NOT NULL CHECK (role IN ('student', 'staff')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS dormitories (
  dorm_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  gender_type TEXT    NOT NULL CHECK (gender_type IN ('male', 'female', 'mixed')),
  capacity    INTEGER NOT NULL CHECK (capacity > 0),  -- зөвшөөрч болох оюутны дээд тоо
  address     TEXT,
  description TEXT,
  monthly_fee INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),  -- төгрөг / сар
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)) -- 0 бол хүсэлт авахгүй
);

CREATE TABLE IF NOT EXISTS rooms (
  room_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  dorm_id     INTEGER NOT NULL REFERENCES dormitories (dorm_id) ON DELETE CASCADE,
  room_number TEXT    NOT NULL,
  floor       INTEGER NOT NULL CHECK (floor BETWEEN 0 AND 30),
  capacity    INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 12),   -- орны тоо
  gender      TEXT    CHECK (gender IN ('male', 'female')),        -- холимог байрны өрөөний хүйс (NULL = заагаагүй)
  UNIQUE (dorm_id, room_number)
);

CREATE TABLE IF NOT EXISTS applications (
  application_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id         INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  dorm_id            INTEGER NOT NULL REFERENCES dormitories (dorm_id),
  room_id            INTEGER REFERENCES rooms (room_id) ON DELETE SET NULL,
  academic_year      TEXT    NOT NULL,                -- жишээ: 2026-2027
  phone              TEXT    NOT NULL,
  emergency_name     TEXT    NOT NULL,
  emergency_phone    TEXT    NOT NULL,
  emergency_relation TEXT,                            -- эцэг, эх, ах ...
  home_province      TEXT,                            -- аймаг / нийслэл
  course_year        INTEGER CHECK (course_year BETWEEN 1 AND 6),
  priority_tags      TEXT    NOT NULL DEFAULT '',     -- таслалаар тусгаарласан код: rural,orphan
  reason             TEXT    NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  staff_note         TEXT,                            -- ажилтны шийдвэрийн тайлбар
  reviewed_by        INTEGER REFERENCES users (user_id) ON DELETE SET NULL,
  reviewed_at        TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Нэг хичээлийн жилд нэг идэвхтэй хүсэлт (цуцалсан хүсэлт тооцогдохгүй)
CREATE UNIQUE INDEX IF NOT EXISTS ux_applications_student_year
  ON applications (student_id, academic_year) WHERE status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications (student_id);
CREATE INDEX IF NOT EXISTS idx_applications_year_status ON applications (academic_year, status);
CREATE INDEX IF NOT EXISTS idx_applications_room ON applications (room_id);

CREATE TABLE IF NOT EXISTS application_events (
  event_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications (application_id) ON DELETE CASCADE,
  actor_id       INTEGER REFERENCES users (user_id) ON DELETE SET NULL,
  action         TEXT    NOT NULL CHECK (action IN (
                   'SUBMITTED', 'UPDATED', 'CANCELLED', 'APPROVED', 'REJECTED',
                   'ROOM_ASSIGNED', 'ROOM_REMOVED', 'REOPENED')),
  note           TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_application ON application_events (application_id);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL DEFAULT '',
  link            TEXT,
  is_read         INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  audience        TEXT    NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'student', 'staff')),
  is_pinned       INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  author_id       INTEGER REFERENCES users (user_id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Системийн тохиргоо (хүсэлт авах хугацаа, бүртгэл нээлттэй эсэх)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Нэвтэрсэн хэрэглэгчийн session (сервер дахин асахад устахгүй)
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT    PRIMARY KEY,
  sess       TEXT    NOT NULL,
  user_id    INTEGER,
  expires_at INTEGER NOT NULL                         -- Unix milliseconds
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
