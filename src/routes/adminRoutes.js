const express = require('express');
const { requireRole } = require('../middleware/auth');
const {
  validateDorm, validateRoom, validateBulkRooms, validateApprove, validateReject,
  validateRoomChange, validateReopen, validateAnnouncement, validateSettings,
} = require('../validators/adminValidator');
const {
  validateUserCreate, validateUserUpdate, validatePasswordReset,
} = require('../validators/authValidator');
const { parseId } = require('../validators/common');
const {
  yearParam, statusParam, idParam, searchParam, pageParams, oneOf,
} = require('./query');
const { SORTS } = require('../services/applicationService');
const { toCsv } = require('../utils/csv');
const { currentAcademicYear } = require('../utils/time');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, invalid } = require('../errors');
const { GENDER_LABELS } = require('../constants');
const config = require('../config');

function idFrom(req, message = 'Дугаар буруу байна') {
  const id = parseId(req.params.id);
  if (!id) throw badRequest(message);
  return id;
}

/** Validator-ийн үр дүнг шалгаад data буцаана */
function check({ errors, data }) {
  if (errors) throw invalid(errors);
  return data;
}

/** UTC "2026-10-22 04:05:26" → Улаанбаатарын цагаар "2026-10-22 12:05" */
function localTime(utcText) {
  if (!utcText) return '';
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: config.timeZone, dateStyle: 'short', timeStyle: 'short',
  }).format(date);
}

/** Зөвхөн ажилтанд зориулсан удирдлагын API (/api/admin/...) */
function createAdminRouter(services, { sessionStore }) {
  const router = express.Router();
  const {
    applications, dorms, users, announcements, settings, stats,
  } = services;

  router.use(requireRole('staff'));

  // ================= Хянах самбар =================
  router.get('/stats', (req, res) => {
    res.json(stats.overview(yearParam(req.query.year) || currentAcademicYear()));
  });

  // ================= Хүсэлтүүд =================
  function applicationFilters(query) {
    return {
      year: yearParam(query.year),
      status: statusParam(query.status),
      dormId: idParam(query.dormId, 'Байрны дугаар буруу байна'),
      q: searchParam(query.q),
      sort: oneOf(query.sort, Object.keys(SORTS), 'newest'),
      ...pageParams(query),
    };
  }

  router.get('/applications', (req, res) => {
    res.json(applications.adminList(applicationFilters(req.query)));
  });

  // Excel-д нээж болох CSV файл
  router.get('/applications/export', (req, res) => {
    const filters = applicationFilters(req.query);
    const rows = applications.exportList(filters).map((a) => [
      a.id, a.student.code, a.student.name, GENDER_LABELS[a.student.gender], a.student.email, a.phone,
      a.academicYear, a.dormName, a.roomNumber || '', a.homeProvince || '', a.courseLabel || '',
      a.priorityLabels.join('; '), a.emergencyName, a.emergencyRelation || '', a.emergencyPhone,
      a.statusLabel, localTime(a.createdAt), localTime(a.reviewedAt), a.staffNote || '', a.reason,
    ]);
    const csv = toCsv([
      '№', 'Оюутны код', 'Овог нэр', 'Хүйс', 'Имэйл', 'Утас', 'Хичээлийн жил', 'Байр', 'Өрөө',
      'Аймаг/хот', 'Курс', 'Давуу эрх', 'Яаралтай холбогдох хүн', 'Хамаарал', 'Түүний утас',
      'Төлөв', 'Илгээсэн', 'Шийдвэрлэсэн', 'Ажилтны тайлбар', 'Шалтгаан',
    ], rows);
    const name = `odb-huselt-${filters.year || 'buh-jil'}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  });

  router.get('/applications/:id/rooms', (req, res) => {
    res.json(applications.roomOptions(idFrom(req)));
  });

  router.post('/applications/:id/approve', (req, res) => {
    const application = applications.approve(req.session.user, idFrom(req), check(validateApprove(req.body)));
    res.json({ message: 'Хүсэлтийг зөвшөөрлөө', application });
  });

  router.post('/applications/:id/reject', (req, res) => {
    const application = applications.reject(req.session.user, idFrom(req), check(validateReject(req.body)));
    res.json({ message: 'Хүсэлтээс татгалзлаа', application });
  });

  router.post('/applications/:id/room', (req, res) => {
    const application = applications.changeRoom(req.session.user, idFrom(req), check(validateRoomChange(req.body)));
    res.json({ message: application.roomId ? 'Өрөө хуваариллаа' : 'Өрөөний хуваарилалтыг цуцаллаа', application });
  });

  router.post('/applications/:id/reopen', (req, res) => {
    const application = applications.reopen(req.session.user, idFrom(req), check(validateReopen(req.body)));
    res.json({ message: 'Хүсэлтийг дахин хянахаар буцаалаа', application });
  });

  // ================= Байр, өрөө =================
  router.get('/dorms', (req, res) => {
    res.json({ dormitories: dorms.list(yearParam(req.query.year) || currentAcademicYear()) });
  });

  router.post('/dorms', (req, res) => {
    res.status(201).json({ message: 'Байр нэмлээ', dorm: dorms.create(check(validateDorm(req.body)), currentAcademicYear()) });
  });

  router.put('/dorms/:id', (req, res) => {
    const dorm = dorms.update(idFrom(req), check(validateDorm(req.body)), currentAcademicYear());
    res.json({ message: 'Байрны мэдээллийг хадгаллаа', dorm });
  });

  router.delete('/dorms/:id', (req, res) => {
    dorms.remove(idFrom(req));
    res.json({ message: 'Байрыг устгалаа' });
  });

  router.get('/dorms/:id/rooms', (req, res) => {
    res.json(dorms.rooms(idFrom(req), yearParam(req.query.year) || currentAcademicYear()));
  });

  router.post('/dorms/:id/rooms', (req, res) => {
    const room = dorms.createRoom(idFrom(req), check(validateRoom(req.body)), currentAcademicYear());
    res.status(201).json({ message: 'Өрөө нэмлээ', room });
  });

  router.post('/dorms/:id/rooms/bulk', (req, res) => {
    const result = dorms.bulkCreateRooms(idFrom(req), check(validateBulkRooms(req.body)), currentAcademicYear());
    const skipped = result.skipped ? `, ${result.skipped} өрөө аль хэдийн байсан` : '';
    res.status(201).json({ message: `${result.created} өрөө нэмлээ${skipped}`, ...result });
  });

  router.put('/rooms/:id', (req, res) => {
    const room = dorms.updateRoom(idFrom(req), check(validateRoom(req.body)), currentAcademicYear());
    res.json({ message: 'Өрөөний мэдээллийг хадгаллаа', room });
  });

  router.delete('/rooms/:id', (req, res) => {
    dorms.removeRoom(idFrom(req), currentAcademicYear());
    res.json({ message: 'Өрөөг устгалаа' });
  });

  // ================= Хэрэглэгчид =================
  router.get('/users', (req, res) => {
    res.json(users.list({
      q: searchParam(req.query.q),
      role: oneOf(req.query.role, ['student', 'staff'], null),
      ...pageParams(req.query, 25),
    }));
  });

  router.post('/users', asyncHandler(async (req, res) => {
    const user = await users.create(check(validateUserCreate(req.body)));
    res.status(201).json({ message: 'Хэрэглэгч нэмлээ', user });
  }));

  router.put('/users/:id', (req, res) => {
    const id = idFrom(req);
    const user = users.update(req.session.user, id, check(validateUserUpdate(req.body)));
    if (!user.isActive) sessionStore.destroyByUser(id);
    res.json({ message: 'Хэрэглэгчийн мэдээллийг хадгаллаа', user });
  });

  router.post('/users/:id/password', asyncHandler(async (req, res) => {
    const id = idFrom(req);
    await users.resetPassword(id, check(validatePasswordReset(req.body)).password);
    sessionStore.destroyByUser(id, id === req.session.user.id ? req.sessionID : null);
    res.json({ message: 'Нууц үгийг шинэчиллээ' });
  }));

  // ================= Мэдээлэл =================
  router.get('/announcements', (req, res) => {
    res.json({ announcements: announcements.listAll() });
  });

  router.post('/announcements', (req, res) => {
    const announcement = announcements.create(req.session.user, check(validateAnnouncement(req.body)));
    res.status(201).json({ message: 'Мэдээлэл нийтэллээ', announcement });
  });

  router.put('/announcements/:id', (req, res) => {
    const announcement = announcements.update(idFrom(req), check(validateAnnouncement(req.body)));
    res.json({ message: 'Мэдээллийг хадгаллаа', announcement });
  });

  router.delete('/announcements/:id', (req, res) => {
    announcements.remove(idFrom(req));
    res.json({ message: 'Мэдээллийг устгалаа' });
  });

  // ================= Тохиргоо =================
  router.get('/settings', (req, res) => {
    res.json({ settings: settings.get(), window: settings.applicationWindow() });
  });

  router.put('/settings', (req, res) => {
    const saved = settings.update(check(validateSettings(req.body)));
    res.json({ message: 'Тохиргоог хадгаллаа', settings: saved, window: settings.applicationWindow() });
  });

  return router;
}

module.exports = { createAdminRouter };
