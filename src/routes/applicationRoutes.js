const express = require('express');
const { requireRole } = require('../middleware/auth');
const { validateApplication, parseId } = require('../validators/applicationValidator');
const { currentAcademicYear } = require('../utils/time');
const { AppError, invalid } = require('../errors');

function idFrom(req) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'Хүсэлтийн дугаар буруу байна');
  return id;
}

// PATCH-аар оюутан засаж болох талбарууд
const EDITABLE = [
  'dormId', 'phone', 'emergencyName', 'emergencyPhone', 'emergencyRelation',
  'homeProvince', 'courseYear', 'priorityTags', 'reason',
];

/** Оюутны хүсэлттэй холбоотой endpoint-ууд (нэвтэрсэн байхыг app.js шалгана) */
function createApplicationRouter(services) {
  const router = express.Router();
  const { applications, dorms, settings } = services;

  /**
   * Манай сургууль нэг дотуур байртай тул оюутан байр сонгох шаардлагагүй:
   * dormId ирээгүй бөгөөд тухайн оюутанд хүсэлт авч буй ганц байр байвал түүнийг онооно.
   * (Байр нэмэгдвэл dormId-г form-оос сонгодог хэвээр ажиллана.)
   */
  function withDefaultDorm(req) {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
    if (!body || !(body.dormId === undefined || body.dormId === null || body.dormId === '')) return req.body;
    const available = dorms.list(currentAcademicYear(), req.session.user);
    return available.length === 1 ? { ...body, dormId: available[0].id } : body;
  }

  // Form-ын сонголтод зориулсан байрны жагсаалт (сул орны тоотой)
  router.get('/dormitories', (req, res) => {
    res.json({ dormitories: dorms.list(currentAcademicYear(), req.session.user) });
  });

  // Хүсэлт хүлээн авч буй эсэх
  router.get('/applications/window', (req, res) => {
    res.json({ window: settings.applicationWindow() });
  });

  // US-01: Дотуур байранд суух хүсэлт илгээх
  router.post('/applications', requireRole('student'), (req, res) => {
    const { errors, data } = validateApplication(withDefaultDorm(req));
    if (errors) throw invalid(errors);
    const application = applications.create(req.session.user, data);
    res.status(201).json({ message: 'Хүсэлт амжилттай илгээгдлээ', application });
  });

  // Оюутны өөрийн илгээсэн хүсэлтүүд
  router.get('/applications/my', requireRole('student'), (req, res) => {
    const list = applications.listForStudent(req.session.user.id);
    const body = { applications: list, currentYear: currentAcademicYear() };
    if (list.length === 0) body.message = 'Илгээсэн хүсэлт байхгүй байна';
    res.json(body);
  });

  // Нэг хүсэлтийн дэлгэрэнгүй (эзэмшигч эсвэл ажилтан)
  router.get('/applications/:id', (req, res) => {
    res.json({ application: applications.getById(req.session.user, idFrom(req)) });
  });

  // Хүлээгдэж буй хүсэлтээ засах
  router.put('/applications/:id', requireRole('student'), (req, res) => {
    const id = idFrom(req);
    const { errors, data } = validateApplication(withDefaultDorm(req));
    if (errors) throw invalid(errors);
    const application = applications.update(req.session.user, id, data);
    res.json({ message: 'Хүсэлтийг хадгаллаа', application });
  });

  // Лаб 11 — REST: хүлээгдэж буй хүсэлтийн зарим талбарыг засах (PATCH).
  // Өгсөн талбарыг одоогийн утга дээр давхарлаж, бүтэн form-ын дүрмээр шалгана.
  router.patch('/applications/:id', requireRole('student'), (req, res) => {
    const id = idFrom(req);
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if ('status' in body || 'staffNote' in body || 'roomId' in body) {
      throw new AppError(403, 'Хүсэлтийн төлөв, өрөөг зөвхөн ажилтан өөрчилнө');
    }
    const changed = EDITABLE.filter((f) => Object.hasOwn(body, f));
    if (changed.length === 0) throw invalid({ form: 'Өөрчлөх талбар өгөгдөөгүй байна' });

    const current = applications.getById(req.session.user, id);
    const merged = Object.fromEntries(EDITABLE.map((f) => [f, current[f]]));
    changed.forEach((f) => { merged[f] = body[f]; });
    const { errors, data } = validateApplication(merged);
    if (errors) throw invalid(errors);
    const application = applications.update(req.session.user, id, data);
    res.json({ message: 'Хүсэлтийг хадгаллаа', application });
  });

  // Хүлээгдэж буй хүсэлтээ цуцлах
  router.post('/applications/:id/cancel', requireRole('student'), (req, res) => {
    const application = applications.cancel(req.session.user, idFrom(req));
    res.json({ message: 'Хүсэлтийг цуцаллаа', application });
  });

  // Лаб 11 — REST: DELETE нь физик устгал биш, хүсэлтийг CANCELLED төлөвт шилжүүлнэ (түүх хадгалагдана)
  router.delete('/applications/:id', requireRole('student'), (req, res) => {
    applications.cancel(req.session.user, idFrom(req));
    res.status(204).end();
  });

  return router;
}

module.exports = { createApplicationRouter };
