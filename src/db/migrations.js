const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, '..', '..', 'database', 'schema.sql');

/** Одоогийн schema-ийн хувилбар. Бүтэц өөрчлөгдөх бүрт нэмэгдүүлнэ. */
const SCHEMA_VERSION = 2;

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function addColumn(db, table, column, definition) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Лабораторийн ажил 5-ын анхны (v1) өгөгдлийн санг v2 болгоно.
 * Өгөгдөл устахгүй: хуучин хүсэлтүүдийг шинэ хүснэгт рүү хуулна.
 */
function upgradeFromV1(db, schemaSql) {
  // Хүснэгт дахин үүсгэх үед foreign key-г түр унтраана (SQLite-ийн зөвлөмж)
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      addColumn(db, 'users', 'phone', 'TEXT');
      addColumn(db, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))');
      addColumn(db, 'users', 'last_login_at', 'TEXT');

      addColumn(db, 'dormitories', 'address', 'TEXT');
      addColumn(db, 'dormitories', 'description', 'TEXT');
      addColumn(db, 'dormitories', 'monthly_fee', 'INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0)');
      addColumn(db, 'dormitories', 'is_active', 'INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))');

      // applications хүснэгтийн CHECK болон UNIQUE өөрчлөгдсөн тул шинээр үүсгэнэ
      const oldApplications = tableExists(db, 'applications') && !columnExists(db, 'applications', 'room_id');
      if (oldApplications) {
        db.exec('DROP INDEX IF EXISTS idx_applications_student');
        db.exec('ALTER TABLE applications RENAME TO applications_v1');
      }

      db.exec(schemaSql); // дутуу хүснэгт, индексүүдийг үүсгэнэ (IF NOT EXISTS)

      if (oldApplications) {
        db.exec(`
          INSERT INTO applications
            (application_id, student_id, dorm_id, academic_year, phone, emergency_name,
             emergency_phone, reason, status, created_at, updated_at)
          SELECT application_id, student_id, dorm_id, academic_year, phone, emergency_name,
                 emergency_phone, reason, status, created_at, created_at
            FROM applications_v1;

          INSERT INTO application_events (application_id, actor_id, action, created_at)
          SELECT application_id, student_id, 'SUBMITTED', created_at FROM applications_v1;

          DROP TABLE applications_v1;
        `);
      }

      const problems = db.pragma('foreign_key_check');
      if (problems.length > 0) {
        throw new Error(`Migration foreign key алдаа: ${JSON.stringify(problems)}`);
      }
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Өгөгдлийн санг хамгийн сүүлийн бүтэц рүү авчирна.
 *  - Хоосон сан → schema.sql-ийг бүтнээр ажиллуулна
 *  - Хуучин сан → upgradeFromV1
 */
/**
 * Энэ кодоор шинэчлэх боломжгүй өгөгдлийн сан: ирээдүйн хувилбар, эсвэл байр сонгох
 * баганагүй туршилтын (Лаб 11-ийн нэг байрны) бүтэц. Ийм үед өгөгдлийг эвдэхгүйгээр зогсоно.
 */
function assertCompatible(db, version) {
  const foreign = version > SCHEMA_VERSION
    || (tableExists(db, 'applications') && !columnExists(db, 'applications', 'dorm_id'));
  if (foreign) {
    throw new Error(
      'Өгөгдлийн сан өөр хувилбарын бүтэцтэй байна. '
      + '.env дахь DB_FILE файлыг (жишээ нь data/ эсвэл database/odb.db) устгаад "npm run seed" ажиллуулна уу.'
    );
  }
}

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });
  assertCompatible(db, version);
  if (version >= SCHEMA_VERSION) return;

  const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  if (!tableExists(db, 'users')) {
    db.exec(schemaSql);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
    return;
  }
  upgradeFromV1(db, schemaSql);
}

module.exports = { migrate, SCHEMA_VERSION };
