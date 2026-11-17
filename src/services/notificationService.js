const { notFound } = require('../errors');

function toDto(row) {
  return {
    id: row.notification_id,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

function createNotificationService(db) {
  const stmt = {
    insert: db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)'),
    list: db.prepare(
      `SELECT * FROM notifications WHERE user_id = ?
        ORDER BY created_at DESC, notification_id DESC LIMIT ?`
    ),
    unread: db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0'),
    markRead: db.prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?'),
    markAll: db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'),
  };

  return {
    notify(userId, { title, body = '', link = null }) {
      stmt.insert.run(userId, title, body, link);
    },

    listForUser(userId, limit = 30) {
      return {
        notifications: stmt.list.all(userId, limit).map(toDto),
        unread: stmt.unread.get(userId).n,
      };
    },

    /** Зөвхөн өөрийн мэдэгдлийг уншсан болгоно (бусдынхад 404) */
    markRead(userId, id) {
      if (stmt.markRead.run(id, userId).changes === 0) throw notFound('Мэдэгдэл олдсонгүй');
    },

    markAllRead(userId) {
      stmt.markAll.run(userId);
    },
  };
}

module.exports = { createNotificationService };
