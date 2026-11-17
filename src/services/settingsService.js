const { today, currentAcademicYear } = require('../utils/time');

const DEFAULTS = {
  applications_open: '1',
  registration_open: '1',
  application_start: '',
  application_deadline: '',
};

function createSettingsService(db) {
  const stmt = {
    all: db.prepare('SELECT key, value FROM settings'),
    upsert: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
    ),
  };

  function raw() {
    const values = { ...DEFAULTS };
    stmt.all.all().forEach((row) => {
      if (Object.hasOwn(DEFAULTS, row.key)) values[row.key] = row.value;
    });
    return values;
  }

  const service = {
    get() {
      const r = raw();
      return {
        applicationsOpen: r.applications_open === '1',
        registrationOpen: r.registration_open === '1',
        applicationStart: r.application_start,
        applicationDeadline: r.application_deadline,
      };
    },

    update(data) {
      db.transaction(() => {
        stmt.upsert.run('applications_open', data.applicationsOpen ? '1' : '0');
        stmt.upsert.run('registration_open', data.registrationOpen ? '1' : '0');
        stmt.upsert.run('application_start', data.applicationStart);
        stmt.upsert.run('application_deadline', data.applicationDeadline);
      })();
      return service.get();
    },

    /**
     * Одоо хүсэлт хүлээн авч байгаа эсэх.
     * @returns {{ open: boolean, message: string|null, academicYear: string, start: string, deadline: string }}
     */
    applicationWindow(now = new Date()) {
      const s = service.get();
      const t = today(now);
      const base = { academicYear: currentAcademicYear(now), start: s.applicationStart, deadline: s.applicationDeadline };
      if (!s.applicationsOpen) {
        return { ...base, open: false, message: 'Хүсэлт хүлээн авах хугацаа хаагдсан байна' };
      }
      if (s.applicationStart && t < s.applicationStart) {
        return { ...base, open: false, message: `Хүсэлтийг ${s.applicationStart}-ээс эхлэн хүлээн авна` };
      }
      if (s.applicationDeadline && t > s.applicationDeadline) {
        return { ...base, open: false, message: `Хүсэлт хүлээн авах хугацаа ${s.applicationDeadline}-нд дууссан` };
      }
      return { ...base, open: true, message: null };
    },
  };
  return service;
}

module.exports = { createSettingsService };
