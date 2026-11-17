const session = require('express-session');

const PRUNE_INTERVAL_MS = 15 * 60 * 1000; // 15 минут тутам хугацаа дууссан session устгана

/**
 * express-session-д зориулсан SQLite store.
 * MemoryStore-оос ялгаатай нь сервер дахин асахад хэрэглэгч гарахгүй,
 * мөн санах ой дүүрэхгүй. Хэрэглэгчийн бүх session-ийг нэг дор устгах
 * боломжтой (нууц үг солиход, бүртгэл идэвхгүй болгоход).
 */
class SqliteSessionStore extends session.Store {
  constructor(db, { defaultTtlMs = 30 * 60 * 1000 } = {}) {
    super();
    this.defaultTtlMs = defaultTtlMs;
    this.stmt = {
      get: db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires_at > ?'),
      upsert: db.prepare(
        `INSERT INTO sessions (sid, sess, user_id, expires_at) VALUES (@sid, @sess, @userId, @expiresAt)
         ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, user_id = excluded.user_id, expires_at = excluded.expires_at`
      ),
      touch: db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      destroyByUser: db.prepare('DELETE FROM sessions WHERE user_id = ? AND sid IS NOT ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    };
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    this.pruneTimer.unref(); // процесс дуусахад саад болохгүй
  }

  expiresAt(sess) {
    const expires = sess && sess.cookie && sess.cookie.expires;
    return expires ? new Date(expires).getTime() : Date.now() + this.defaultTtlMs;
  }

  get(sid, callback) {
    try {
      const row = this.stmt.get.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      this.stmt.upsert.run({
        sid,
        sess: JSON.stringify(sess),
        userId: sess.user ? sess.user.id : null,
        expiresAt: this.expiresAt(sess),
      });
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      this.stmt.touch.run(this.expiresAt(sess), sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.stmt.destroy.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  /** Хэрэглэгчийн бүх session-ийг (exceptSid-ээс бусад) устгана. */
  destroyByUser(userId, exceptSid = null) {
    this.stmt.destroyByUser.run(userId, exceptSid);
  }

  prune() {
    this.stmt.prune.run(Date.now());
  }
}

module.exports = { SqliteSessionStore };
