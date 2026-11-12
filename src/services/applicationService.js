const { AppError } = require('../errors');
const { createApplicationModel } = require('../models/applicationModel');
const {
  validateApplication,
  validateApplicationUpdate,
  validateReview,
} = require('../validators/applicationValidator');

const STATUS_LABELS = {
  PENDING: 'Хүлээгдэж буй',
  APPROVED: 'Зөвшөөрсөн',
  REJECTED: 'Татгалзсан',
  CANCELLED: 'Цуцалсан',
};
const STATUSES = Object.keys(STATUS_LABELS);

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
    studentUsername: row.student_username,
    studentName: row.student_name,
    dormId: row.dorm_id,
    dormName: row.dorm_name,
    academicYear: row.academic_year,
    phone: row.phone,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    reason: row.reason,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const notPending = (row) => new AppError(
  409,
  `Зөвхөн "Хүлээгдэж буй" хүсэлтийг өөрчлөх боломжтой (одоогийн төлөв: ${STATUS_LABELS[row.status]})`
);

/**
 * Service давхарга: бизнесийн дүрэм (эрх, төлөвийн шилжилт, хүйс, нэг жилд нэг хүсэлт).
 * Өгөгдлийн сантай зөвхөн model-оор дамжиж харилцана.
 */
function createApplicationService(db) {
  const model = createApplicationModel(db);

  /** Хүсэлтийг олж, хэрэглэгч харах эрхтэй эсэхийг шалгана (IDOR хамгаалалт). */
  function loadVisible(user, applicationId) {
    const row = model.findById(applicationId);
    if (!row) throw new AppError(404, 'Хүсэлт олдсонгүй');
    if (user.role === 'student' && row.student_id !== user.id) {
      throw new AppError(403, 'Хандах эрхгүй (Access denied)');
    }
    return row;
  }

  function assertDormAllowed(user, dormId) {
    const dorm = model.findDormById(dormId);
    if (!dorm) {
      throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Сонгосон байр олдсонгүй' });
    }
    if (dorm.gender_type !== 'mixed' && dorm.gender_type !== user.gender) {
      throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Энэ байр таны хүйсэнд тохирохгүй байна' });
    }
  }

  return {
    /** Оюутанд өөрийн хүйсийн болон холимог байр, ажилтанд бүх байр. */
    listDormitories(user) {
      const rows = user.role === 'student'
        ? model.listDormitoriesForGender(user.gender)
        : model.listDormitories();
      return rows.map((r) => ({ id: r.dorm_id, name: r.name, genderType: r.gender_type, capacity: r.capacity }));
    },

    /** CREATE — хүсэлт бүртгэнэ (US-01). studentId-г зөвхөн session-оос авна. */
    create(user, body, now = new Date()) {
      const { errors, data } = validateApplication(body);
      if (errors) throw new AppError(400, 'Form-ын мэдээлэл буруу байна', errors);
      assertDormAllowed(user, data.dormId);

      const academicYear = currentAcademicYear(now);
      if (model.hasActiveForYear(user.id, academicYear)) {
        throw new AppError(409, `Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
      }
      try {
        const id = model.insert({ ...data, studentId: user.id, academicYear });
        return toDto(model.findById(id));
      } catch (err) {
        // Зэрэг илгээсэн 2 хүсэлтийн аль нэг нь UNIQUE index-д баригдана
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new AppError(409, `Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
        }
        throw err;
      }
    },

    /** READ (жагсаалт) — оюутан өөрийнхийг, ажилтан бүгдийг (status-аар шүүж болно). */
    list(user, query = {}) {
      if (user.role === 'student') return model.listByStudent(user.id).map(toDto);
      let status;
      if (query.status !== undefined && query.status !== '') {
        status = String(query.status).toUpperCase();
        if (!STATUSES.includes(status)) {
          throw new AppError(400, 'Төлөвийн шүүлтүүр буруу байна', { status: `Боломжит утга: ${STATUSES.join(', ')}` });
        }
      }
      return model.listAll(status).map(toDto);
    },

    /** READ (нэг бичлэг). */
    getById(user, applicationId) {
      return toDto(loadVisible(user, applicationId));
    },

    /**
     * UPDATE — оюутан PENDING хүсэлтийнхээ талбарыг засна;
     * ажилтан PENDING хүсэлтийг APPROVED / REJECTED болгоно (US-05).
     */
    update(user, applicationId, body) {
      const row = loadVisible(user, applicationId);

      if (user.role === 'staff') {
        const { errors, data } = validateReview(body);
        if (errors) throw new AppError(400, 'Шийдвэрийн мэдээлэл буруу байна', errors);
        if (row.status !== 'PENDING') throw notPending(row);
        const changed = model.updateStatus(applicationId, {
          status: data.status, fromStatus: 'PENDING', reviewNote: data.reviewNote, reviewedBy: user.id,
        });
        if (!changed) throw notPending(model.findById(applicationId));
        return toDto(model.findById(applicationId));
      }

      // Оюутан төлөвөө өөрөө өөрчлөхийг хориглоно (mass assignment)
      if (body && typeof body === 'object' && ('status' in body || 'reviewNote' in body)) {
        throw new AppError(403, 'Хүсэлтийн төлөвийг зөвхөн ажилтан өөрчилнө');
      }
      if (row.status !== 'PENDING') throw notPending(row);

      const current = {
        dormId: row.dorm_id,
        phone: row.phone,
        emergencyName: row.emergency_name,
        emergencyPhone: row.emergency_phone,
        reason: row.reason,
      };
      const { errors, data, changed } = validateApplicationUpdate(body, current);
      if (errors) throw new AppError(400, 'Form-ын мэдээлэл буруу байна', errors);
      if (changed.includes('dormId')) assertDormAllowed(user, data.dormId);

      if (!model.updateFields(applicationId, data)) throw notPending(model.findById(applicationId));
      return toDto(model.findById(applicationId));
    },

    /**
     * DELETE — физик устгал биш: оюутан PENDING хүсэлтээ CANCELLED төлөвт шилжүүлнэ.
     * Түүх хадгалагдаж, тухайн жилд дахин хүсэлт илгээх боломжтой болно.
     */
    cancel(user, applicationId) {
      const row = loadVisible(user, applicationId);
      if (row.status !== 'PENDING') throw notPending(row);
      if (!model.updateStatus(applicationId, { status: 'CANCELLED', fromStatus: 'PENDING' })) {
        throw notPending(model.findById(applicationId));
      }
    },
  };
}

module.exports = { createApplicationService, currentAcademicYear, STATUS_LABELS, STATUSES };
