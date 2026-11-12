/**
 * Model давхарга: зөвхөн өгөгдлийн сантай харилцана (SQL query).
 * Бүх query prepared statement + параметр ашиглана (SQL injection-ээс хамгаална).
 * Бизнесийн дүрэм энд байхгүй — service давхаргад байна.
 */
function createApplicationModel(db) {
  const SELECT = `
    SELECT a.*, u.username AS student_username, u.full_name AS student_name
    FROM applications a
    JOIN users u ON u.user_id = a.student_id`;

  const stmt = {
    activeForYear: db.prepare(
      `SELECT 1 FROM applications
       WHERE student_id = ? AND academic_year = ? AND status <> 'CANCELLED'`
    ),
    insert: db.prepare(
      `INSERT INTO applications
         (student_id, academic_year, phone, emergency_name, emergency_phone, reason)
       VALUES (@studentId, @academicYear, @phone, @emergencyName, @emergencyPhone, @reason)`
    ),
    byId: db.prepare(`${SELECT} WHERE a.application_id = ?`),
    byStudent: db.prepare(`${SELECT} WHERE a.student_id = ? ORDER BY a.created_at DESC, a.application_id DESC`),
    all: db.prepare(`${SELECT} ORDER BY a.created_at DESC, a.application_id DESC`),
    allByStatus: db.prepare(`${SELECT} WHERE a.status = ? ORDER BY a.created_at DESC, a.application_id DESC`),
    updateFields: db.prepare(
      `UPDATE applications
       SET phone = @phone, emergency_name = @emergencyName,
           emergency_phone = @emergencyPhone, reason = @reason, updated_at = datetime('now')
       WHERE application_id = @id AND status = 'PENDING'`
    ),
    updateStatus: db.prepare(
      `UPDATE applications
       SET status = @status, review_note = @reviewNote, reviewed_by = @reviewedBy,
           reviewed_at = CASE WHEN @reviewedBy IS NULL THEN reviewed_at ELSE datetime('now') END,
           updated_at = datetime('now')
       WHERE application_id = @id AND status = @fromStatus`
    ),
  };

  return {
    hasActiveForYear: (studentId, academicYear) => Boolean(stmt.activeForYear.get(studentId, academicYear)),
    insert: (data) => stmt.insert.run(data).lastInsertRowid,
    findById: (id) => stmt.byId.get(id),
    listByStudent: (studentId) => stmt.byStudent.all(studentId),
    listAll: (status) => (status ? stmt.allByStatus.all(status) : stmt.all.all()),

    /** Зөвхөн PENDING төлөвтэй хүсэлтийг шинэчилнэ. Өөрчлөгдсөн мөрийн тоог буцаана. */
    updateFields: (id, data) => stmt.updateFields.run({ ...data, id }).changes,

    /** fromStatus төлөвтэй үед л төлөвийг сольно (зэрэг өөрчлөлтөөс хамгаална). */
    updateStatus: (id, { status, fromStatus, reviewNote = null, reviewedBy = null }) => (
      stmt.updateStatus.run({ id, status, fromStatus, reviewNote, reviewedBy }).changes
    ),
  };
}

module.exports = { createApplicationModel };
