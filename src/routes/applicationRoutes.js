const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateApplication } = require('../validators/applicationValidator');
const { createApplicationService } = require('../services/applicationService');
const { AppError } = require('../errors');

const ID_RE = /^[1-9]\d{0,9}$/;

function createApplicationRoutes(db) {
  const router = express.Router();
  const service = createApplicationService(db);

  router.get('/dormitories', requireAuth, (req, res) => {
    res.json({ dormitories: service.listDormitories(req.session.user) });
  });

  // US-01: Дотуур байранд суух хүсэлт илгээх
  router.post('/applications', requireRole('student'), (req, res) => {
    const { errors, data } = validateApplication(req.body);
    if (errors) {
      throw new AppError(400, 'Form-ын мэдээлэл буруу байна', errors);
    }
    const application = service.create(req.session.user, data);
    res.status(201).json({ message: 'Хүсэлт амжилттай илгээгдлээ', application });
  });

  router.get('/applications/my', requireRole('student'), (req, res) => {
    const applications = service.listForStudent(req.session.user);
    const body = { applications };
    if (applications.length === 0) body.message = 'Илгээсэн хүсэлт байхгүй байна';
    res.json(body);
  });

  router.get('/applications/:id', requireAuth, (req, res) => {
    if (!ID_RE.test(req.params.id)) {
      throw new AppError(400, 'Хүсэлтийн дугаар буруу байна');
    }
    const application = service.getById(req.session.user, Number(req.params.id));
    res.json({ application });
  });

  return router;
}

module.exports = { createApplicationRoutes };
