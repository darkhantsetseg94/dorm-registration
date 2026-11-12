const { AppError } = require('../errors');
const { createApplicationService } = require('../services/applicationService');
const { parsePositiveInt } = require('../validators/applicationValidator');

function parseId(req) {
  const id = parsePositiveInt(req.params.id);
  if (Number.isNaN(id)) throw new AppError(400, 'Хүсэлтийн дугаар буруу байна');
  return id;
}

/**
 * Controller давхарга: HTTP хүсэлтээс өгөгдөл авч service-ийг дуудаад,
 * тохирох статус кодоор JSON хариу буцаана. Бизнес логик агуулахгүй.
 */
function createApplicationController(db) {
  const service = createApplicationService(db);

  return {
    // GET /api/applications  (ажилтан: ?status=PENDING)
    list(req, res) {
      res.json({ applications: service.list(req.session.user, req.query) });
    },

    // GET /api/applications/my
    listMy(req, res) {
      const applications = service.list(req.session.user);
      const body = { applications };
      if (applications.length === 0) body.message = 'Илгээсэн хүсэлт байхгүй байна';
      res.json(body);
    },

    // GET /api/applications/:id
    getById(req, res) {
      res.json({ application: service.getById(req.session.user, parseId(req)) });
    },

    // POST /api/applications  — US-01
    create(req, res) {
      const application = service.create(req.session.user, req.body);
      res.status(201).json({ message: 'Хүсэлт амжилттай илгээгдлээ', application });
    },

    // PATCH /api/applications/:id  — оюутан засах / ажилтан шийдвэрлэх
    update(req, res) {
      const application = service.update(req.session.user, parseId(req), req.body);
      const message = req.session.user.role === 'staff'
        ? `Хүсэлтийг "${application.statusLabel}" болголоо`
        : 'Хүсэлт шинэчлэгдлээ';
      res.json({ message, application });
    },

    // DELETE /api/applications/:id  — цуцлах (CANCELLED)
    cancel(req, res) {
      service.cancel(req.session.user, parseId(req));
      res.status(204).end();
    },
  };
}

module.exports = { createApplicationController };
