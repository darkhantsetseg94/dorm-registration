const express = require('express');
const { validateProfileUpdate, validatePasswordChange } = require('../validators/authValidator');
const { parseId } = require('../validators/common');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, invalid } = require('../errors');

/**
 * Нэвтэрсэн хэрэглэгчийн өөрийн бүртгэл, мэдэгдэл, мэдээлэл.
 * Оюутан болон ажилтан хоёуланд нь хамаатай.
 */
function createAccountRouter(services, { sessionStore }) {
  const router = express.Router();
  const { users, notifications, announcements } = services;

  // ----- Профайл -----
  router.get('/profile', (req, res) => {
    res.json({ profile: users.get(req.session.user.id) });
  });

  router.patch('/profile', (req, res) => {
    const { errors, data } = validateProfileUpdate(req.body);
    if (errors) throw invalid(errors);
    res.json({ message: 'Мэдээллийг хадгаллаа', profile: users.updateProfile(req.session.user.id, data) });
  });

  router.post('/profile/password', asyncHandler(async (req, res) => {
    const { errors, data } = validatePasswordChange(req.body);
    if (errors) throw invalid(errors);
    await users.changePassword(req.session.user.id, data);
    // Бусад төхөөрөмж дээрх session-уудыг гаргана, одоогийнхыг үлдээнэ
    sessionStore.destroyByUser(req.session.user.id, req.sessionID);
    res.json({ message: 'Нууц үг амжилттай солигдлоо' });
  }));

  // ----- Мэдэгдэл -----
  router.get('/notifications', (req, res) => {
    res.json(notifications.listForUser(req.session.user.id));
  });

  router.post('/notifications/read-all', (req, res) => {
    notifications.markAllRead(req.session.user.id);
    res.json({ message: 'Бүгдийг уншсан' });
  });

  router.post('/notifications/:id/read', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw badRequest('Дугаар буруу байна');
    notifications.markRead(req.session.user.id, id);
    res.json({ message: 'Уншсан' });
  });

  // ----- Мэдээлэл, зарлал -----
  router.get('/announcements', (req, res) => {
    res.json({ announcements: announcements.listForRole(req.session.user.role) });
  });

  return router;
}

module.exports = { createAccountRouter };
