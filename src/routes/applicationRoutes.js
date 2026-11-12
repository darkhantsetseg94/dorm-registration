const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createApplicationController } = require('../controllers/applicationController');

/**
 * Route давхарга: URL + HTTP method-ийг эрхийн middleware болон controller-той холбоно.
 */
function createApplicationRoutes(db) {
  const router = express.Router();
  const ctrl = createApplicationController(db);

  router.get('/applications', requireAuth, ctrl.list);
  router.get('/applications/my', requireRole('student'), ctrl.listMy);
  router.post('/applications', requireRole('student'), ctrl.create);
  router.get('/applications/:id', requireAuth, ctrl.getById);
  router.patch('/applications/:id', requireRole('student', 'staff'), ctrl.update);
  router.delete('/applications/:id', requireRole('student'), ctrl.cancel);

  return router;
}

module.exports = { createApplicationRoutes };
