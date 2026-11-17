const bcrypt = require('bcryptjs');
const config = require('../config');
const { ROLE_LABELS, GENDER_LABELS } = require('../constants');
const { AppError, notFound, conflict, invalid } = require('../errors');

function toDto(row) {
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    genderLabel: GENDER_LABELS[row.gender],
    role: row.role,
    roleLabel: ROLE_LABELS[row.role],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/** Session-д хадгалах хамгийн бага мэдээлэл */
function toSessionUser(row) {
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    gender: row.gender,
    role: row.role,
  };
}

const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

function createUserService(db, { settingsService }) {
  const stmt = {
    byUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
    byId: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    usernameTaken: db.prepare('SELECT user_id FROM users WHERE username = ? COLLATE NOCASE'),
    emailTaken: db.prepare('SELECT user_id FROM users WHERE email = ? COLLATE NOCASE AND user_id IS NOT ?'),
    insert: db.prepare(
      `INSERT INTO users (username, full_name, email, phone, password_hash, gender, role)
       VALUES (@username, @fullName, @email, @phone, @passwordHash, @gender, @role)`
    ),
    updateProfile: db.prepare('UPDATE users SET email = @email, phone = @phone WHERE user_id = @id'),
    updateByStaff: db.prepare(
      `UPDATE users SET full_name = @fullName, email = @email, phone = @phone, gender = @gender, is_active = @isActive
        WHERE user_id = @id`
    ),
    setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?'),
    recordLogin: db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE user_id = ?"),
    activeApplications: db.prepare(
      "SELECT COUNT(*) AS n FROM applications WHERE student_id = ? AND status IN ('PENDING', 'APPROVED')"
    ),
  };

  function getRow(id) {
    const row = stmt.byId.get(id);
    if (!row) throw notFound('Хэрэглэгч олдсонгүй');
    return row;
  }

  function checkUnique({ username, email }, userId = null) {
    const details = {};
    if (username && stmt.usernameTaken.get(username)) details.username = 'Энэ нэвтрэх нэр бүртгэлтэй байна';
    if (stmt.emailTaken.get(email, userId)) details.email = 'Энэ имэйл хаяг бүртгэлтэй байна';
    if (Object.keys(details).length > 0) throw conflict('Мэдээлэл давхардаж байна', details);
  }

  async function insertUser(data) {
    checkUnique(data);
    const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);
    try {
      const result = stmt.insert.run({ ...data, passwordHash });
      return getRow(result.lastInsertRowid);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw conflict('Мэдээлэл давхардаж байна');
      throw err;
    }
  }

  const service = {
    toDto,
    toSessionUser,

    findForLogin(username) {
      return stmt.byUsername.get(username) || null;
    },

    findById(id) {
      return stmt.byId.get(id) || null;
    },

    get(id) {
      return toDto(getRow(id));
    },

    recordLogin(id) {
      stmt.recordLogin.run(id);
    },

    /** Оюутан өөрөө бүртгүүлэх */
    async register(data) {
      if (!settingsService.get().registrationOpen) {
        throw new AppError(403, 'Шинээр бүртгүүлэх боломж одоогоор хаалттай байна. Дотуур байрны ажилтанд хандана уу');
      }
      return insertUser({ ...data, role: 'student' });
    },

    updateProfile(id, { email, phone }) {
      getRow(id);
      checkUnique({ email }, id);
      stmt.updateProfile.run({ id, email, phone });
      return service.get(id);
    },

    async changePassword(id, { currentPassword, newPassword }) {
      const row = getRow(id);
      const ok = await bcrypt.compare(currentPassword, row.password_hash);
      if (!ok) throw invalid({ currentPassword: 'Одоогийн нууц үг буруу байна' }, 'Нууц үг буруу байна');
      stmt.setPassword.run(await bcrypt.hash(newPassword, config.bcryptRounds), id);
    },

    // ---------------- Ажилтны удирдлага ----------------

    list({ q, role, page, pageSize }) {
      const where = [];
      const params = {};
      if (role) { where.push('role = @role'); params.role = role; }
      if (q) {
        where.push(`(lower_unicode(full_name) LIKE @q ESCAPE '\\' OR lower_unicode(username) LIKE @q ESCAPE '\\'
                     OR lower_unicode(email) LIKE @q ESCAPE '\\' OR phone LIKE @q ESCAPE '\\')`);
        params.q = `%${escapeLike(q.toLowerCase())}%`;
      }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT COUNT(*) AS n FROM users ${w}`).get(params).n;
      const pages = Math.max(Math.ceil(total / pageSize), 1);
      const current = Math.min(page, pages);
      const rows = db.prepare(
        `SELECT * FROM users ${w} ORDER BY role = 'student', lower_unicode(full_name) LIMIT @limit OFFSET @offset`
      ).all({ ...params, limit: pageSize, offset: (current - 1) * pageSize });
      return { users: rows.map(toDto), total, page: current, pages, pageSize };
    },

    async create(data) {
      return toDto(await insertUser(data));
    },

    update(actor, id, data) {
      const row = getRow(id);
      if (actor.id === id && !data.isActive) {
        throw invalid({ isActive: 'Өөрийн бүртгэлийг идэвхгүй болгох боломжгүй' });
      }
      if (data.gender !== row.gender && stmt.activeApplications.get(id).n > 0) {
        throw invalid({ gender: 'Идэвхтэй хүсэлттэй оюутны хүйсийг өөрчлөх боломжгүй' });
      }
      checkUnique({ email: data.email }, id);
      stmt.updateByStaff.run({ ...data, id, isActive: data.isActive ? 1 : 0 });
      return service.get(id);
    },

    async resetPassword(id, password) {
      getRow(id);
      stmt.setPassword.run(await bcrypt.hash(password, config.bcryptRounds), id);
    },
  };
  return service;
}

module.exports = { createUserService };
