const {
  STATUS_LABELS, EVENT_LABELS, PRIORITY_TAGS, COURSE_LABELS, GENDER_LABELS,
} = require('../constants');
const { AppError, forbidden, notFound, conflict, invalid } = require('../errors');
const { currentAcademicYear } = require('../utils/time');

const BASE_SELECT = `
  SELECT a.*,
         d.name AS dorm_name, d.monthly_fee AS dorm_fee, d.address AS dorm_address,
         r.room_number, r.floor AS room_floor,
         u.full_name AS student_name, u.username AS student_code, u.gender AS student_gender,
         u.email AS student_email,
         rv.full_name AS reviewer_name
    FROM applications a
    JOIN dormitories d ON d.dorm_id = a.dorm_id
    JOIN users u ON u.user_id = a.student_id
    LEFT JOIN rooms r ON r.room_id = a.room_id
    LEFT JOIN users rv ON rv.user_id = a.reviewed_by`;

// Жагсаалтыг эрэмбэлэх боломжит хувилбарууд (whitelist — SQL-д шууд оруулахгүй)
const SORTS = {
  newest: 'a.created_at DESC, a.application_id DESC',
  oldest: 'a.created_at ASC, a.application_id ASC',
  name: 'lower_unicode(u.full_name) ASC, a.application_id ASC',
  priority: `(CASE WHEN a.priority_tags = '' THEN 0
               ELSE length(a.priority_tags) - length(replace(a.priority_tags, ',', '')) + 1 END) DESC,
             a.created_at ASC`,
};

const splitTags = (text) => (text ? text.split(',').filter(Boolean) : []);

function toDto(row) {
  const tags = splitTags(row.priority_tags);
  return {
    id: row.application_id,
    studentId: row.student_id,
    dormId: row.dorm_id,
    dormName: row.dorm_name,
    dormFee: row.dorm_fee,
    dormAddress: row.dorm_address,
    roomId: row.room_id,
    roomNumber: row.room_number ?? null,
    roomFloor: row.room_floor ?? null,
    academicYear: row.academic_year,
    phone: row.phone,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    emergencyRelation: row.emergency_relation,
    homeProvince: row.home_province,
    courseYear: row.course_year,
    courseLabel: row.course_year ? COURSE_LABELS[row.course_year] : null,
    priorityTags: tags,
    priorityLabels: tags.map((t) => PRIORITY_TAGS[t]).filter(Boolean),
    reason: row.reason,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    staffNote: row.staff_note,
    reviewerName: row.reviewer_name ?? null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: {
      name: row.student_name,
      code: row.student_code,
      gender: row.student_gender,
      genderLabel: GENDER_LABELS[row.student_gender],
      email: row.student_email,
    },
  };
}

function eventDto(row) {
  return {
    id: row.event_id,
    action: row.action,
    label: EVENT_LABELS[row.action],
    note: row.note,
    actorName: row.actor_name ?? null,
    actorRole: row.actor_role ?? null,
    createdAt: row.created_at,
  };
}

/** LIKE-ийн %, _ тэмдэгтийг энгийн тэмдэгт болгоно */
const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

function createApplicationService(db, { dormService, settingsService, notificationService }) {
  // Бүх query parameterized — SQL Injection-оос хамгаална
  const stmt = {
    existing: db.prepare(
      "SELECT application_id FROM applications WHERE student_id = ? AND academic_year = ? AND status <> 'CANCELLED'"
    ),
    insert: db.prepare(
      `INSERT INTO applications
         (student_id, dorm_id, academic_year, phone, emergency_name, emergency_phone, emergency_relation,
          home_province, course_year, priority_tags, reason)
       VALUES (@studentId, @dormId, @academicYear, @phone, @emergencyName, @emergencyPhone, @emergencyRelation,
          @homeProvince, @courseYear, @priorityTags, @reason)`
    ),
    update: db.prepare(
      `UPDATE applications
          SET dorm_id = @dormId, phone = @phone, emergency_name = @emergencyName, emergency_phone = @emergencyPhone,
              emergency_relation = @emergencyRelation, home_province = @homeProvince, course_year = @courseYear,
              priority_tags = @priorityTags, reason = @reason, updated_at = datetime('now')
        WHERE application_id = @id`
    ),
    setStatus: db.prepare(
      `UPDATE applications
          SET status = @status, room_id = @roomId, staff_note = @note, reviewed_by = @reviewedBy,
              reviewed_at = CASE WHEN @reviewedBy IS NULL THEN NULL ELSE datetime('now') END,
              updated_at = datetime('now')
        WHERE application_id = @id`
    ),
    setRoom: db.prepare(
      "UPDATE applications SET room_id = ?, updated_at = datetime('now') WHERE application_id = ?"
    ),
    cancel: db.prepare(
      "UPDATE applications SET status = 'CANCELLED', updated_at = datetime('now') WHERE application_id = ?"
    ),
    byId: db.prepare(`${BASE_SELECT} WHERE a.application_id = ?`),
    byStudent: db.prepare(
      `${BASE_SELECT} WHERE a.student_id = ? ORDER BY a.created_at DESC, a.application_id DESC`
    ),
    events: db.prepare(
      `SELECT e.*, u.full_name AS actor_name, u.role AS actor_role
         FROM application_events e LEFT JOIN users u ON u.user_id = e.actor_id
        WHERE e.application_id = ? ORDER BY e.created_at, e.event_id`
    ),
    addEvent: db.prepare(
      'INSERT INTO application_events (application_id, actor_id, action, note) VALUES (?, ?, ?, ?)'
    ),
  };

  function getRow(id) {
    const row = stmt.byId.get(id);
    if (!row) throw notFound('Хүсэлт олдсонгүй');
    return row;
  }

  function withEvents(row) {
    return { ...toDto(row), events: stmt.events.all(row.application_id).map(eventDto) };
  }

  function ownRow(user, id) {
    const row = getRow(id);
    if (row.student_id !== user.id) throw forbidden();
    return row;
  }

  /** Хүсэлт илгээх/засах үеийн байрны шалгалт */
  function checkDormForStudent(user, dormId, academicYear, currentDormId = null) {
    const dorm = dormService.getRow(dormId, academicYear);
    if (!dorm) {
      throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Сонгосон байр олдсонгүй' });
    }
    if (dorm.gender_type !== 'mixed' && dorm.gender_type !== user.gender) {
      throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Энэ байр таны хүйсэнд тохирохгүй байна' });
    }
    if (dorm.dorm_id !== currentDormId) {
      if (dorm.is_active !== 1) {
        throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Энэ байр одоогоор хүсэлт хүлээн авахгүй байна' });
      }
      if (dorm.approved >= dorm.capacity) {
        throw new AppError(400, 'Хүсэлт буруу байна', { dormId: 'Энэ байранд сул ор үлдээгүй байна' });
      }
    }
    return dorm;
  }

  function checkWindow(now) {
    const window = settingsService.applicationWindow(now);
    if (!window.open) throw new AppError(403, window.message);
    return window;
  }

  /** Өрөөнд байрлуулж болох эсэхийг шалгаад өрөөг буцаана */
  function assignableRoom(row, roomId) {
    let room;
    try {
      room = dormService.getRoom(roomId, row.academic_year);
    } catch (err) {
      throw invalid({ roomId: 'Өрөө олдсонгүй' });
    }
    if (room.dormId !== row.dorm_id) throw invalid({ roomId: 'Энэ өрөө хүсэлтийн байранд хамаарахгүй' });

    // Оюутан аль хэдийн энэ өрөөнд байгаа бол өөрийгөө тооцохгүй
    if (row.status === 'APPROVED' && row.room_id === room.id) {
      const key = row.student_gender === 'male' ? 'maleCount' : 'femaleCount';
      room = { ...room, occupied: room.occupied - 1, [key]: room[key] - 1 };
    }
    const problem = dormService.roomProblem(room, row.student_gender);
    if (problem) throw invalid({ roomId: problem });
    return room;
  }

  function requireStatus(row, statuses, message) {
    if (!statuses.includes(row.status)) throw conflict(message);
  }

  const notify = (row, title, body) => notificationService.notify(row.student_id, { title, body, link: '/dashboard.html' });

  const service = {
    // ===================== Оюутан =====================

    /** Хүсэлт бүртгэнэ (US-01). studentId-г зөвхөн session-оос авна. */
    create(user, data, now = new Date()) {
      const { academicYear } = checkWindow(now);
      checkDormForStudent(user, data.dormId, academicYear);

      if (stmt.existing.get(user.id, academicYear)) {
        throw conflict(`Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
      }

      try {
        const id = db.transaction(() => {
          const result = stmt.insert.run({
            ...data, priorityTags: data.priorityTags.join(','), studentId: user.id, academicYear,
          });
          stmt.addEvent.run(result.lastInsertRowid, user.id, 'SUBMITTED', null);
          return result.lastInsertRowid;
        })();
        return withEvents(getRow(id));
      } catch (err) {
        // Зэрэг илгээсэн 2 хүсэлтийн аль нэг нь UNIQUE constraint-д баригдана
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw conflict(`Та ${academicYear} хичээлийн жилд хүсэлт илгээсэн байна`);
        }
        throw err;
      }
    },

    /** Хүлээгдэж буй хүсэлтээ засах */
    update(user, id, data, now = new Date()) {
      const row = ownRow(user, id);
      requireStatus(row, ['PENDING'], 'Зөвхөн хүлээгдэж буй хүсэлтийг засах боломжтой');
      checkWindow(now);
      checkDormForStudent(user, data.dormId, row.academic_year, row.dorm_id);

      db.transaction(() => {
        stmt.update.run({ ...data, priorityTags: data.priorityTags.join(','), id });
        stmt.addEvent.run(id, user.id, 'UPDATED', null);
      })();
      return withEvents(getRow(id));
    },

    /** Хүлээгдэж буй хүсэлтээ цуцлах. Дараа нь дахин илгээж болно. */
    cancel(user, id) {
      const row = ownRow(user, id);
      requireStatus(row, ['PENDING'], 'Зөвхөн хүлээгдэж буй хүсэлтийг цуцлах боломжтой');
      db.transaction(() => {
        stmt.cancel.run(id);
        stmt.addEvent.run(id, user.id, 'CANCELLED', null);
      })();
      return withEvents(getRow(id));
    },

    listForStudent(studentId) {
      return stmt.byStudent.all(studentId).map(toDto);
    },

    /** Нэг хүсэлтийг харах. Оюутан зөвхөн өөрийн хүсэлтийг харна (IDOR хамгаалалт). */
    getById(user, applicationId) {
      const row = getRow(applicationId);
      if (user.role === 'student' && row.student_id !== user.id) throw forbidden();
      return withEvents(row);
    },

    // ===================== Ажилтан =====================

    /** Шүүлттэй, хуудаслалттай жагсаалт + төлөв бүрийн тоо */
    adminList(filters) {
      const { where, params } = service.buildFilter(filters);
      const statusWhere = filters.status ? [...where, 'a.status = @status'] : where;
      const statusParams = filters.status ? { ...params, status: filters.status } : params;
      const sql = (w) => (w.length ? `WHERE ${w.join(' AND ')}` : '');
      const from = `FROM applications a JOIN users u ON u.user_id = a.student_id`;

      const total = db.prepare(`SELECT COUNT(*) AS n ${from} ${sql(statusWhere)}`).get(statusParams).n;
      const pageSize = filters.pageSize;
      const pages = Math.max(Math.ceil(total / pageSize), 1);
      const page = Math.min(filters.page, pages);
      const rows = db
        .prepare(`${BASE_SELECT} ${sql(statusWhere)} ORDER BY ${SORTS[filters.sort]} LIMIT @limit OFFSET @offset`)
        .all({ ...statusParams, limit: pageSize, offset: (page - 1) * pageSize });

      const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
      db.prepare(`SELECT a.status, COUNT(*) AS n ${from} ${sql(where)} GROUP BY a.status`)
        .all(params)
        .forEach((r) => { counts[r.status] = r.n; });

      return { applications: rows.map(toDto), total, page, pages, pageSize, counts };
    },

    /** CSV экспортод зориулж шүүлтэд таарах бүх мөр */
    exportList(filters) {
      const { where, params } = service.buildFilter(filters);
      if (filters.status) {
        where.push('a.status = @status');
        params.status = filters.status;
      }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      return db.prepare(`${BASE_SELECT} ${w} ORDER BY ${SORTS[filters.sort]}`).all(params).map(toDto);
    },

    buildFilter({ year, dormId, q }) {
      const where = [];
      const params = {};
      if (year) { where.push('a.academic_year = @year'); params.year = year; }
      if (dormId) { where.push('a.dorm_id = @dormId'); params.dormId = dormId; }
      if (q) {
        where.push(`(lower_unicode(u.full_name) LIKE @q ESCAPE '\\'
                     OR lower_unicode(u.username) LIKE @q ESCAPE '\\'
                     OR a.phone LIKE @q ESCAPE '\\')`);
        params.q = `%${escapeLike(q.toLowerCase())}%`;
      }
      return { where, params };
    },

    /** Хүсэлтийн байрны өрөөнүүд: багтах эсэх, санал болгох өрөө */
    roomOptions(id) {
      const row = getRow(id);
      const rooms = dormService.roomsForDorm(row.dorm_id, row.academic_year).map((room) => {
        let adjusted = room;
        if (row.status === 'APPROVED' && row.room_id === room.id) {
          const key = row.student_gender === 'male' ? 'maleCount' : 'femaleCount';
          adjusted = { ...room, occupied: room.occupied - 1, [key]: room[key] - 1 };
        }
        const problem = dormService.roomProblem(adjusted, row.student_gender);
        return { ...room, current: row.room_id === room.id, fits: !problem, problem };
      });
      // Хагас дүүрсэн өрөөг эхэлж дүүргэнэ (сул ор цөөтэй нь эхэнд)
      const suggestion = rooms
        .filter((r) => r.fits && !r.current)
        .sort((a, b) => (b.occupied > 0) - (a.occupied > 0)
          || (a.capacity - a.occupied) - (b.capacity - b.occupied)
          || a.floor - b.floor)[0];
      const dorm = dormService.get(row.dorm_id, row.academic_year);
      return { rooms, suggestedRoomId: suggestion ? suggestion.id : null, dorm };
    },

    approve(staff, id, { roomId, note }) {
      const row = getRow(id);
      requireStatus(row, ['PENDING'], 'Энэ хүсэлт аль хэдийн шийдвэрлэгдсэн байна');
      const dorm = dormService.getRow(row.dorm_id, row.academic_year);
      if (dorm.approved >= dorm.capacity) {
        throw conflict(`${dorm.name} дүүрсэн байна (${dorm.approved}/${dorm.capacity} ор)`);
      }
      const room = roomId ? assignableRoom(row, roomId) : null;

      db.transaction(() => {
        stmt.setStatus.run({ id, status: 'APPROVED', roomId: room ? room.id : null, note, reviewedBy: staff.id });
        stmt.addEvent.run(id, staff.id, 'APPROVED', note);
        if (room) stmt.addEvent.run(id, staff.id, 'ROOM_ASSIGNED', `${room.roomNumber} тоот өрөө`);
        notify(row, 'Таны хүсэлт зөвшөөрөгдлөө', room
          ? `${row.dorm_name}, ${room.roomNumber} тоот өрөө. ${note || ''}`.trim()
          : `${row.dorm_name}. Өрөөг удахгүй хуваарилна. ${note || ''}`.trim());
      })();
      return withEvents(getRow(id));
    },

    reject(staff, id, { note }) {
      const row = getRow(id);
      requireStatus(row, ['PENDING'], 'Энэ хүсэлт аль хэдийн шийдвэрлэгдсэн байна');
      db.transaction(() => {
        stmt.setStatus.run({ id, status: 'REJECTED', roomId: null, note, reviewedBy: staff.id });
        stmt.addEvent.run(id, staff.id, 'REJECTED', note);
        notify(row, 'Таны хүсэлтээс татгалзлаа', note);
      })();
      return withEvents(getRow(id));
    },

    /** Зөвшөөрсөн оюутны өрөөг солих / хуваарилалтыг цуцлах (roomId = null) */
    changeRoom(staff, id, { roomId }) {
      const row = getRow(id);
      requireStatus(row, ['APPROVED'], 'Зөвхөн зөвшөөрсөн хүсэлтэд өрөө хуваарилна');
      if (roomId === null) {
        if (row.room_id === null) return withEvents(row);
        db.transaction(() => {
          stmt.setRoom.run(null, id);
          stmt.addEvent.run(id, staff.id, 'ROOM_REMOVED', `${row.room_number} тоот өрөө`);
          notify(row, 'Өрөөний хуваарилалт өөрчлөгдлөө', 'Шинэ өрөөг удахгүй мэдэгдэнэ.');
        })();
        return withEvents(getRow(id));
      }
      if (row.room_id === roomId) return withEvents(row);
      const room = assignableRoom(row, roomId);
      db.transaction(() => {
        stmt.setRoom.run(room.id, id);
        stmt.addEvent.run(id, staff.id, 'ROOM_ASSIGNED', `${room.roomNumber} тоот өрөө`);
        notify(row, 'Танд өрөө хуваарилагдлаа', `${row.dorm_name}, ${room.roomNumber} тоот өрөө`);
      })();
      return withEvents(getRow(id));
    },

    /** Шийдвэрээ буцааж, хүсэлтийг дахин "Хүлээгдэж буй" болгох */
    reopen(staff, id, { note }) {
      const row = getRow(id);
      requireStatus(row, ['APPROVED', 'REJECTED'], 'Зөвхөн шийдвэрлэгдсэн хүсэлтийг буцаах боломжтой');
      db.transaction(() => {
        stmt.setStatus.run({ id, status: 'PENDING', roomId: null, note, reviewedBy: null });
        stmt.addEvent.run(id, staff.id, 'REOPENED', note);
        notify(row, 'Таны хүсэлтийг дахин хянаж байна', note || 'Шийдвэрийг удахгүй мэдэгдэнэ.');
      })();
      return withEvents(getRow(id));
    },
  };
  return service;
}

module.exports = { createApplicationService, currentAcademicYear, STATUS_LABELS, SORTS };
