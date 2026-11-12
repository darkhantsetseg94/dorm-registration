const request = require('supertest');
const { createTestApp, loginAs, VALID_APPLICATION } = require('./helpers');

/**
 * Лаб 11: REST API — CRUD (Create, Read, Update, Delete) тест.
 * TC-01 … TC-06 нь лабораторийн зааврын тест, бусад нь эрх болон бизнесийн дүрэм.
 */
describe('Лаб 11: Хүсэлтийн CRUD API', () => {
  let app;
  let db;
  let student;
  let created;

  beforeEach(async () => {
    ({ app, db } = createTestApp());
    student = await loginAs(app, 'B221910001');
    created = (await student.post('/api/applications').send(VALID_APPLICATION)).body.application;
  });

  describe('Лабын тест', () => {
    test('TC-01: зөв POST → 201 Created', async () => {
      const other = await loginAs(app, 'B221910002');
      const res = await other.post('/api/applications').send(VALID_APPLICATION);
      expect(res.status).toBe(201);
      expect(res.body.application).toMatchObject({ studentUsername: 'B221910002', status: 'PENDING' });
    });

    test('TC-02: шаардлагатай талбар хоосон → 400 Bad Request', async () => {
      const other = await loginAs(app, 'B221910002');
      const res = await other.post('/api/applications').send({ ...VALID_APPLICATION, reason: '' });
      expect(res.status).toBe(400);
      expect(res.body.details).toHaveProperty('reason');
    });

    test('TC-03: байгаа ID-тай GET → 200 OK', async () => {
      const res = await student.get(`/api/applications/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.application.id).toBe(created.id);
    });

    test('TC-04: байхгүй ID-тай GET → 404 Not Found', async () => {
      const res = await student.get('/api/applications/9999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Хүсэлт олдсонгүй');
    });

    test('TC-05: зөв PATCH → 200 OK, өөрчлөлт хадгалагдана', async () => {
      const res = await student
        .patch(`/api/applications/${created.id}`)
        .send({ phone: '95556677', emergencyName: 'Сараа' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Хүсэлт шинэчлэгдлээ');
      expect(res.body.application).toMatchObject({ phone: '95556677', emergencyName: 'Сараа', status: 'PENDING' });
      expect(res.body.application.reason).toBe(VALID_APPLICATION.reason); // өөрчлөөгүй талбар хэвээр

      const row = db.prepare('SELECT phone, emergency_name FROM applications WHERE application_id = ?').get(created.id);
      expect(row).toEqual({ phone: '95556677', emergency_name: 'Сараа' });
    });

    test('TC-06: зөвшөөрөгдсөн DELETE → 204, бичлэг CANCELLED төлөвт шилжинэ', async () => {
      const res = await student.delete(`/api/applications/${created.id}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      const row = db.prepare('SELECT status FROM applications WHERE application_id = ?').get(created.id);
      expect(row.status).toBe('CANCELLED'); // физик устгал биш
    });
  });

  describe('Оюутны засвар, цуцлалт', () => {
    test('цуцалсны дараа тухайн жилд дахин хүсэлт илгээх боломжтой', async () => {
      await student.delete(`/api/applications/${created.id}`);
      const again = await student.post('/api/applications').send(VALID_APPLICATION);
      expect(again.status).toBe(201);

      const my = await student.get('/api/applications/my');
      expect(my.body.applications.map((a) => a.status)).toEqual(['PENDING', 'CANCELLED']);
    });

    test('PATCH буруу утгатай → 400, зөвхөн тухайн талбарын алдаа', async () => {
      const res = await student.patch(`/api/applications/${created.id}`).send({ phone: '123' });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.details)).toEqual(['phone']);
    });

    test('PATCH өөрчлөх талбаргүй → 400', async () => {
      const res = await student.patch(`/api/applications/${created.id}`).send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.details.form).toBe('Өөрчлөх талбар өгөгдөөгүй байна');
    });

    test('PATCH-аар dormId илгээвэл → 400 (байр сонгох талбар байхгүй)', async () => {
      const res = await student.patch(`/api/applications/${created.id}`).send({ dormId: 2 });
      expect(res.status).toBe(400);
      expect(res.body.details.form).toBe('Өөрчлөх талбар өгөгдөөгүй байна');
    });

    test('оюутан өөрөө status өөрчлөх оролдлого → 403', async () => {
      const res = await student.patch(`/api/applications/${created.id}`).send({ status: 'APPROVED' });
      expect(res.status).toBe(403);
      const row = db.prepare('SELECT status FROM applications WHERE application_id = ?').get(created.id);
      expect(row.status).toBe('PENDING');
    });

    test('өөр оюутны хүсэлтийг засах, цуцлах → 403', async () => {
      const other = await loginAs(app, 'B221910002');
      const patch = await other.patch(`/api/applications/${created.id}`).send({ phone: '95556677' });
      const del = await other.delete(`/api/applications/${created.id}`);
      expect(patch.status).toBe(403);
      expect(del.status).toBe(403);
    });

    test('шийдвэрлэгдсэн хүсэлтийг засах, цуцлах → 409', async () => {
      const staff = await loginAs(app, 'staff01');
      await staff.patch(`/api/applications/${created.id}`).send({ status: 'APPROVED' });

      const patch = await student.patch(`/api/applications/${created.id}`).send({ phone: '95556677' });
      const del = await student.delete(`/api/applications/${created.id}`);
      expect(patch.status).toBe(409);
      expect(del.status).toBe(409);
    });

    test('нэвтрээгүй PATCH, DELETE → 401', async () => {
      const patch = await request(app).patch(`/api/applications/${created.id}`).send({ phone: '95556677' });
      const del = await request(app).delete(`/api/applications/${created.id}`);
      expect(patch.status).toBe(401);
      expect(del.status).toBe(401);
    });

    test('ID-д тоо биш утга → 400', async () => {
      const res = await student.delete('/api/applications/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('Ажилтан хүсэлт шийдвэрлэх (US-05)', () => {
    let staff;

    beforeEach(async () => {
      staff = await loginAs(app, 'staff01');
    });

    test('бүх хүсэлтийн жагсаалт, төлөвөөр шүүх', async () => {
      const other = await loginAs(app, 'B221910002');
      const second = (await other.post('/api/applications').send(VALID_APPLICATION)).body.application;
      await other.delete(`/api/applications/${second.id}`);

      const all = await staff.get('/api/applications');
      expect(all.status).toBe(200);
      expect(all.body.applications).toHaveLength(2);
      expect(all.body.applications[0]).toHaveProperty('studentUsername');

      const pending = await staff.get('/api/applications?status=pending');
      expect(pending.body.applications.map((a) => a.id)).toEqual([created.id]);
    });

    test('буруу төлөвийн шүүлтүүр → 400', async () => {
      const res = await staff.get('/api/applications?status=DONE');
      expect(res.status).toBe(400);
    });

    test('оюутны GET /api/applications зөвхөн өөрийнхийг буцаана', async () => {
      const other = await loginAs(app, 'B221910002');
      await other.post('/api/applications').send(VALID_APPLICATION);
      const res = await student.get('/api/applications');
      expect(res.body.applications.map((a) => a.id)).toEqual([created.id]);
    });

    test('зөвшөөрөх → 200, APPROVED, хэн хэзээ шийдвэрлэсэн нь хадгалагдана', async () => {
      const res = await staff.patch(`/api/applications/${created.id}`).send({ status: 'APPROVED' });
      expect(res.status).toBe(200);
      expect(res.body.application).toMatchObject({ status: 'APPROVED', statusLabel: 'Зөвшөөрсөн' });
      expect(res.body.application.reviewedAt).toBeTruthy();

      const row = db.prepare('SELECT reviewed_by FROM applications WHERE application_id = ?').get(created.id);
      const staffId = db.prepare("SELECT user_id FROM users WHERE username = 'staff01'").get().user_id;
      expect(row.reviewed_by).toBe(staffId);
    });

    test('татгалзахад шалтгаан заавал → 400, шалтгаантай бол 200', async () => {
      const noNote = await staff.patch(`/api/applications/${created.id}`).send({ status: 'REJECTED' });
      expect(noNote.status).toBe(400);
      expect(noNote.body.details).toHaveProperty('reviewNote');

      const ok = await staff
        .patch(`/api/applications/${created.id}`)
        .send({ status: 'REJECTED', reviewNote: 'Байрны багтаамж дүүрсэн' });
      expect(ok.status).toBe(200);
      expect(ok.body.application).toMatchObject({ status: 'REJECTED', reviewNote: 'Байрны багтаамж дүүрсэн' });

      const student2 = await student.get(`/api/applications/${created.id}`);
      expect(student2.body.application.statusLabel).toBe('Татгалзсан');
    });

    test('аль хэдийн шийдвэрлэсэн хүсэлтийг дахин шийдвэрлэх → 409', async () => {
      await staff.patch(`/api/applications/${created.id}`).send({ status: 'APPROVED' });
      const res = await staff
        .patch(`/api/applications/${created.id}`)
        .send({ status: 'REJECTED', reviewNote: 'Алдаа' });
      expect(res.status).toBe(409);
    });

    test('ажилтан хүсэлт цуцлах (DELETE) эрхгүй → 403', async () => {
      const res = await staff.delete(`/api/applications/${created.id}`);
      expect(res.status).toBe(403);
    });
  });
});
