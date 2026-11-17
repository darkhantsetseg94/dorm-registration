const request = require('supertest');
const Database = require('better-sqlite3');
const { migrate } = require('../src/db/migrations');
const { buildTestApp, loginAs, submit, VALID_FORM } = require('./helpers');

/**
 * Лаб 11: REST API (CRUD) ба нэг байрны загвар.
 * Манай сургууль нэг дотуур байртай тул тест бүрт зөвхөн нэг холимог байрыг идэвхтэй үлдээнэ.
 * TC-01 … TC-06 нь лабораторийн зааврын тест.
 */
const DORM = 'Оюутны дотуур байр';
const { dormId: _omit, ...FORM } = VALID_FORM; // оюутан байр сонгохгүй

function buildSingleDormApp() {
  const ctx = buildTestApp();
  ctx.db.prepare('UPDATE dormitories SET is_active = 0 WHERE dorm_id IN (1, 2)').run();
  ctx.db.prepare('UPDATE dormitories SET name = ? WHERE dorm_id = 3').run(DORM);
  return ctx;
}

describe('Лаб 11: нэг байртай систем дэх хүсэлтийн CRUD API', () => {
  let app;
  let db;
  let bat;
  let id;

  beforeEach(async () => {
    ({ app, db } = buildSingleDormApp());
    bat = await loginAs(app, 'bat');
    id = await submit(bat, { dormId: undefined });
  });

  const statusOf = (appId) => db.prepare('SELECT status FROM applications WHERE application_id = ?').get(appId).status;

  describe('Лабын тест', () => {
    test('TC-01: зөв POST (байр сонгохгүй) → 201, ганц байр автоматаар оноогдоно', async () => {
      const saraa = await loginAs(app, 'saraa');
      const res = await saraa.post('/api/applications').send(FORM);
      expect(res.status).toBe(201);
      expect(res.body.application).toMatchObject({ dormName: DORM, status: 'PENDING' });
    });

    test('TC-02: шаардлагатай талбар хоосон → 400', async () => {
      const saraa = await loginAs(app, 'saraa');
      const res = await saraa.post('/api/applications').send({ ...FORM, reason: '' });
      expect(res.status).toBe(400);
      expect(res.body.details).toHaveProperty('reason');
      expect(res.body.details).not.toHaveProperty('dormId');
    });

    test('TC-03: байгаа ID-тай GET → 200', async () => {
      const res = await bat.get(`/api/applications/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.application).toMatchObject({ id, dormName: DORM });
    });

    test('TC-04: байхгүй ID-тай GET → 404', async () => {
      const res = await bat.get('/api/applications/9999');
      expect(res.status).toBe(404);
    });

    test('TC-05: зөв PATCH → 200, зөвхөн өгсөн талбар өөрчлөгдөнө', async () => {
      const res = await bat.patch(`/api/applications/${id}`).send({ phone: '95556677' });
      expect(res.status).toBe(200);
      expect(res.body.application).toMatchObject({
        phone: '95556677', reason: FORM.reason, emergencyName: FORM.emergencyName, dormName: DORM, status: 'PENDING',
      });
      expect(res.body.application.events.map((e) => e.action)).toEqual(['SUBMITTED', 'UPDATED']);
    });

    test('TC-06: зөвшөөрөгдсөн DELETE → 204, CANCELLED төлөвт шилжинэ (физик устгал биш)', async () => {
      const res = await bat.delete(`/api/applications/${id}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(statusOf(id)).toBe('CANCELLED');

      const again = await bat.post('/api/applications').send(FORM);
      expect(again.status).toBe(201);
    });
  });

  describe('PATCH, DELETE-ийн дүрэм', () => {
    test('оюутан PATCH-аар төлөв, өрөө өөрчлөх оролдлого → 403', async () => {
      for (const body of [{ status: 'APPROVED' }, { roomId: 1 }, { staffNote: 'ok' }]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await bat.patch(`/api/applications/${id}`).send(body);
        expect(res.status).toBe(403);
      }
      expect(statusOf(id)).toBe('PENDING');
    });

    test('өөрчлөх талбаргүй PATCH → 400', async () => {
      const res = await bat.patch(`/api/applications/${id}`).send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.details.form).toBe('Өөрчлөх талбар өгөгдөөгүй байна');
    });

    test('буруу утгатай PATCH → 400, өгөгдөл өөрчлөгдөхгүй', async () => {
      const res = await bat.patch(`/api/applications/${id}`).send({ phone: '123' });
      expect(res.status).toBe(400);
      expect(res.body.details).toHaveProperty('phone');
      const row = db.prepare('SELECT phone FROM applications WHERE application_id = ?').get(id);
      expect(row.phone).toBe(FORM.phone);
    });

    test('өөр оюутны хүсэлтийг засах, цуцлах → 403', async () => {
      const saraa = await loginAs(app, 'saraa');
      expect((await saraa.patch(`/api/applications/${id}`).send({ phone: '95556677' })).status).toBe(403);
      expect((await saraa.delete(`/api/applications/${id}`)).status).toBe(403);
      expect(statusOf(id)).toBe('PENDING');
    });

    test('шийдвэрлэгдсэн хүсэлтийг засах, цуцлах → 409', async () => {
      const staff = await loginAs(app, 'staff');
      const rej = await staff.post(`/api/admin/applications/${id}/reject`).send({ note: 'Багтаамж дүүрсэн' });
      expect(rej.status).toBe(200);
      expect((await bat.patch(`/api/applications/${id}`).send({ phone: '95556677' })).status).toBe(409);
      expect((await bat.delete(`/api/applications/${id}`)).status).toBe(409);
    });

    test('нэвтрээгүй PATCH, DELETE → 401; ажилтан DELETE → 403', async () => {
      expect((await request(app).patch(`/api/applications/${id}`).send({ phone: '95556677' })).status).toBe(401);
      expect((await request(app).delete(`/api/applications/${id}`)).status).toBe(401);
      const staff = await loginAs(app, 'staff');
      expect((await staff.delete(`/api/applications/${id}`)).status).toBe(403);
    });
  });

  describe('Нэг байрны загвар', () => {
    test('оюутанд зөвхөн нэг байр харагдана', async () => {
      const res = await bat.get('/api/dormitories');
      expect(res.body.dormitories.map((d) => d.name)).toEqual([DORM]);
    });

    test('холимог байрны өрөө хуваарилахад хүйсний дүрэм хэвээр ажиллана', async () => {
      const saraa = await loginAs(app, 'saraa');
      const saraaId = await submit(saraa, { dormId: undefined });
      const staff = await loginAs(app, 'staff');
      const maleRoom = db.prepare("SELECT room_id FROM rooms WHERE dorm_id = 3 AND room_number = '301'").get().room_id;
      const res = await staff.post(`/api/admin/applications/${saraaId}/approve`).send({ roomId: maleRoom });
      expect(res.status).toBe(400);
    });

    test('хэрэв дахин байр нэмэгдвэл оюутан байраа сонгох шаардлагатай болно', async () => {
      db.prepare('UPDATE dormitories SET is_active = 1').run();
      const saraa = await loginAs(app, 'saraa');
      const res = await saraa.post('/api/applications').send(FORM);
      expect(res.status).toBe(400);
      expect(res.body.details).toHaveProperty('dormId');
    });
  });

  test('байр сонгох баганагүй (хуучин туршилтын) өгөгдлийн санг таньж, ойлгомжтой алдаа өгнө', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE users (user_id INTEGER PRIMARY KEY);
      CREATE TABLE applications (application_id INTEGER PRIMARY KEY, student_id INTEGER);
      PRAGMA user_version = 3;`);
    expect(() => migrate(old)).toThrow(/npm run seed/);
    old.close();
  });
});
