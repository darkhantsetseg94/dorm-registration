const config = require('../config');
const { PRIORITY_TAGS } = require('../constants');

const DAYS = 14;

/** UTC "YYYY-MM-DD HH:MM:SS" → Улаанбаатарын цагаар "YYYY-MM-DD" */
function localDay(utcText) {
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(date);
}

function createStatsService(db, { dormService }) {
  const stmt = {
    statusCounts: db.prepare('SELECT status, COUNT(*) AS n FROM applications WHERE academic_year = ? GROUP BY status'),
    recentCreated: db.prepare(
      "SELECT created_at FROM applications WHERE created_at >= datetime('now', ?)"
    ),
    provinces: db.prepare(
      `SELECT home_province AS name, COUNT(*) AS n FROM applications
        WHERE academic_year = ? AND status <> 'CANCELLED' AND home_province IS NOT NULL
        GROUP BY home_province ORDER BY n DESC, home_province LIMIT 8`
    ),
    tags: db.prepare(
      "SELECT priority_tags FROM applications WHERE academic_year = ? AND status <> 'CANCELLED' AND priority_tags <> ''"
    ),
    users: db.prepare('SELECT role, COUNT(*) AS n FROM users WHERE is_active = 1 GROUP BY role'),
    years: db.prepare('SELECT DISTINCT academic_year FROM applications ORDER BY academic_year DESC'),
  };

  return {
    /** Ажилтны хянах самбарын тоон үзүүлэлтүүд */
    overview(year) {
      const status = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
      stmt.statusCounts.all(year).forEach((r) => { status[r.status] = r.n; });

      const dorms = dormService.list(year);
      const active = dorms.filter((d) => d.isActive);
      const capacity = active.reduce((sum, d) => sum + d.capacity, 0);
      const approvedInActive = active.reduce((sum, d) => sum + d.approved, 0);

      // Сүүлийн 14 хоногт ирсэн хүсэлт (өдөр бүрээр)
      const days = [];
      const now = Date.now();
      for (let i = DAYS - 1; i >= 0; i -= 1) {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(new Date(now - i * 86400000));
        days.push({ date: day, count: 0 });
      }
      stmt.recentCreated.all(`-${DAYS + 1} days`).forEach((r) => {
        const bucket = days.find((d) => d.date === localDay(r.created_at));
        if (bucket) bucket.count += 1;
      });

      const tagCounts = Object.fromEntries(Object.keys(PRIORITY_TAGS).map((k) => [k, 0]));
      stmt.tags.all(year).forEach((r) => r.priority_tags.split(',').forEach((t) => {
        if (Object.hasOwn(tagCounts, t)) tagCounts[t] += 1;
      }));

      const users = { student: 0, staff: 0 };
      stmt.users.all().forEach((r) => { users[r.role] = r.n; });

      const years = stmt.years.all().map((r) => r.academic_year);
      if (!years.includes(year)) years.unshift(year);

      return {
        year,
        years,
        status,
        total: status.PENDING + status.APPROVED + status.REJECTED,
        capacity,
        freeBeds: Math.max(capacity - approvedInActive, 0),
        unassigned: dorms.reduce((sum, d) => sum + d.unassigned, 0),
        dorms,
        daily: days,
        provinces: stmt.provinces.all(year),
        tags: Object.entries(tagCounts).map(([key, n]) => ({ key, label: PRIORITY_TAGS[key], n })),
        users,
      };
    },
  };
}

module.exports = { createStatsService };
