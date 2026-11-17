const { AUDIENCE_LABELS } = require('../constants');
const { notFound } = require('../errors');

function toDto(row) {
  return {
    id: row.announcement_id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    audienceLabel: AUDIENCE_LABELS[row.audience],
    isPinned: row.is_pinned === 1,
    authorName: row.author_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT n.*, u.full_name AS author_name
                  FROM announcements n LEFT JOIN users u ON u.user_id = n.author_id`;
const ORDER = 'ORDER BY n.is_pinned DESC, n.created_at DESC, n.announcement_id DESC';

function createAnnouncementService(db) {
  const stmt = {
    forRole: db.prepare(`${SELECT} WHERE n.audience IN ('all', ?) ${ORDER} LIMIT ?`),
    all: db.prepare(`${SELECT} ${ORDER}`),
    one: db.prepare(`${SELECT} WHERE n.announcement_id = ?`),
    insert: db.prepare(
      `INSERT INTO announcements (title, body, audience, is_pinned, author_id)
       VALUES (@title, @body, @audience, @isPinned, @authorId)`
    ),
    update: db.prepare(
      `UPDATE announcements SET title = @title, body = @body, audience = @audience, is_pinned = @isPinned,
              updated_at = datetime('now') WHERE announcement_id = @id`
    ),
    remove: db.prepare('DELETE FROM announcements WHERE announcement_id = ?'),
  };

  function get(id) {
    const row = stmt.one.get(id);
    if (!row) throw notFound('Мэдээлэл олдсонгүй');
    return toDto(row);
  }

  return {
    listForRole(role, limit = 20) {
      return stmt.forRole.all(role, limit).map(toDto);
    },
    listAll() {
      return stmt.all.all().map(toDto);
    },
    create(author, data) {
      const result = stmt.insert.run({ ...data, isPinned: data.isPinned ? 1 : 0, authorId: author.id });
      return get(result.lastInsertRowid);
    },
    update(id, data) {
      get(id);
      stmt.update.run({ ...data, id, isPinned: data.isPinned ? 1 : 0 });
      return get(id);
    },
    remove(id) {
      get(id);
      stmt.remove.run(id);
    },
  };
}

module.exports = { createAnnouncementService };
