const { AppError } = require('../errors');

const STATUS_LABELS = {
  PENDING: 'Хүлээгдэж буй',
  APPROVED: 'Зөвшөөрсөн',
  REJECTED: 'Татгалзсан',
};

/**
 * Хичээлийн жил 9-р сараас эхэлнэ: 2026.11 → "2026-2027", 2027.03 → "2026-2027".
 */
function currentAcademicYear(now = new Date()) {
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function toDto(row) {
  return {
    id: row.application_id,
    studentId: row.student_id,
    dormId: row.dorm_id,
    dormName: row.dorm_name,
    academicYear: row.academic_year,
    phone: row.phone,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    reason: row.reason,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    createdAt: row.created_at,
  };
}

/**
 * Хүсэлтийн бизнес логик. Бүх SQL query parameterized (prepared statement).
 */
function createApplicationService(db) {
  const SELECT = `SELECT a.*, d.name AS dorm_name
                  FROM applications a JOIN dormitories d ON d.dorm_id = a.dorm_id`;

  const stmt = {
    dormById: db.prepare('SELECT * FROM dormitories WHERE dorm_id = ?'),
    dormsAll: db.prepare('SELECT dorm_id, name, gender_type, capacity FROM dormitories ORDER BY dorm_id'),
    dormsForGender: db.prepare(
      `SELECT dorm_id, name, gender_type, capacity FROM dormitories
       WHERE gender_type IN (?, 'mixed') ORDER BY dorm_id`
    ),
    existing: db.prepare('SELECT 1 FROM applications WHERE student_id = ? AND academic_year = ?'),
    insert: db.prepare(
      `INSERT INTO applications
         (student_id, dorm_id, academic_year, phone, emergency_name, emergency_phone, reason)
       VALUES (@studentId, @dormId, @academicYear, @phone, @emergencyName, @emergencyPhone, @reason)`
    ),
    byId: db.prepare(`${SELECT} WHERE a.application_id = ?`),
    byStudent: db.prepare(`${SELECT} WHERE a.student_id = ? ORDER BY a.created_at DESC, a.application_id DESC`),
  };

  return {
    /**
     * Оюутанд өөрийн хүйсэнд тохирох болон холимог байрыг, ажилтанд бүх байрыг харуулна.
     */
    listDormitories(user) {
      const rows = user.role === 'student' ? stmt.dormsForGender.all(user.gender) : stmt.dormsAll.all();
      return rows.map((r) => ({ id: r.dorm_id, name: r.name, genderType: r.gender_type, capacity: r.capacity }));
    },

    /**
     * Хүсэлт бүртгэнэ. studentId-г зөвхөн session-оос авна.
     */
    create(user, data, now = new Date()) {
      const dorm = stmt.dormById.get(data.dormId);
      if (!dorm) {
        throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Сонгосон байр олдсонгүй' });
      }
      if (dorm.gender_type !== 'mixed' && dorm.gender_type !== user.gender) {
        throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Энэ байр таны хүйсэнд тохирохгүй байна' });
      }

      const academicYear = currentAcademicYear(now);
      if (stmt.existing.get(user.id, academicYear)) {
        throw new AppError(409, `Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
      }

      try {
        const result = stmt.insert.run({ ...data, studentId: user.id, academicYear });
        return toDto(stmt.byId.get(result.lastInsertRowid));
      } catch (err) {
        // Зэрэг илгээсэн 2 хүсэлтийн аль нэг нь UNIQUE constraint-д баригдана
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new AppError(409, `Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
        }
        throw err;
      }
    },

    listForStudent(user) {
      return stmt.byStudent.all(user.id).map(toDto);
    },

    /**
     * Нэг хүсэлтийг харах. Оюутан зөвхөн өөрийн хүсэлтийг харна (IDOR хамгаалалт).
     */
    getById(user, applicationId) {
      const row = stmt.byId.get(applicationId);
      if (!row) throw new AppError(404, 'Хүсэлт олдсонгүй');
      if (user.role === 'student' && row.student_id !== user.id) {
        throw new AppError(403, 'Хандах эрхгүй (Access denied)');
      }
      return toDto(row);
    },
  };
}

module.exports = { createApplicationService, currentAcademicYear, STATUS_LABELS };
