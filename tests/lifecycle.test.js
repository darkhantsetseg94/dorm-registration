const { buildTestApp, loginAs, submit, VALID_FORM } = require('./helpers');
const { currentAcademicYear } = require('../src/utils/time');

describe('Хүсэлтийн амьдралын мөчлөг (оюутны тал)', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  const setSetting = (key, value) => db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  ).run(key, value);

  test('TC30: Нэмэлт мэдээлэл (аймаг, курс, давуу эрх) хадгалагдана', async () => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send({
      ...VALID_FORM, homeProvince: 'Говь-Алтай', courseYear: '2', emergencyRelation: 'Эх', priorityTags: ['rural', 'rural', 'excellence'],
    });
    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({
      homeProvince: 'Говь-Алтай', courseYear: 2, courseLabel: '2-р курс', emergencyRelation: 'Эх',
      priorityTags: ['rural', 'excellence'],
    });
    expect(res.body.application.events.map((e) => e.action)).toEqual(['SUBMITTED']);
  });

  test.each([
    ['байхгүй аймаг', { homeProvince: 'Атлантид' }, 'homeProvince'],
    ['курс 9', { courseYear: 9 }, 'courseYear'],
    ['мэдэгдэхгүй давуу эрх', { priorityTags: ['vip'] }, 'priorityTags'],
    ['давуу эрх массив биш', { priorityTags: 'rural' }, 'priorityTags'],
    ['буруу хамаарал', { emergencyRelation: 'Найз' }, 'emergencyRelation'],
  ])('TC31: Нэмэлт талбарын буруу утга (%s) татгалзана', async (_label, override, field) => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send({ ...VALID_FORM, ...override });
    expect(res.status).toBe(400);
    expect(res.body.details[field]).toBeDefined();
  });

  test('TC32: Хүлээгдэж буй хүсэлтээ засна, түүхэнд "UPDATED" бичигдэнэ', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    const res = await bat.put(`/api/applications/${id}`).send({ ...VALID_FORM, dormId: 3, phone: '99887766' });

    expect(res.status).toBe(200);
    expect(res.body.application).toMatchObject({ dormName: '3-р байр', phone: '99887766', status: 'PENDING' });
    expect(res.body.application.events.map((e) => e.action)).toEqual(['SUBMITTED', 'UPDATED']);
  });

  test('TC33: Өөр оюутны хүсэлтийг засах, цуцлах боломжгүй (403)', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    const tuvshin = await loginAs(app, 'tuvshin');
    expect((await tuvshin.put(`/api/applications/${id}`).send(VALID_FORM)).status).toBe(403);
    expect((await tuvshin.post(`/api/applications/${id}/cancel`)).status).toBe(403);
  });

  test('TC34: Цуцалсан хүсэлтийн дараа тухайн жилдээ дахин илгээж болно', async () => {
    const bat = await loginAs(app, 'bat');
    const first = await submit(bat);
    const cancel = await bat.post(`/api/applications/${first}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.application.status).toBe('CANCELLED');

    expect((await bat.post(`/api/applications/${first}/cancel`)).status).toBe(409);
    const second = await bat.post('/api/applications').send({ ...VALID_FORM, dormId: 3 });
    expect(second.status).toBe(201);

    const my = await bat.get('/api/applications/my');
    expect(my.body.applications.map((a) => a.status)).toEqual(['PENDING', 'CANCELLED']);
  });

  test('TC35: Зөвшөөрөгдсөн хүсэлтийг оюутан засах, цуцлах боломжгүй', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    db.prepare("UPDATE applications SET status = 'APPROVED' WHERE application_id = ?").run(id);

    expect((await bat.put(`/api/applications/${id}`).send(VALID_FORM)).status).toBe(409);
    expect((await bat.post(`/api/applications/${id}/cancel`)).status).toBe(409);
  });

  test('TC36: Хүсэлт авах хугацаа хаалттай үед илгээх боломжгүй (403)', async () => {
    setSetting('applications_open', '0');
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send(VALID_FORM);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Хүсэлт хүлээн авах хугацаа хаагдсан байна');
  });

  test('TC37: Эцсийн хугацаа өнгөрсөн, эсвэл эхлэх өдөр болоогүй үед илгээх боломжгүй', async () => {
    const bat = await loginAs(app, 'bat');
    setSetting('application_deadline', '2000-01-01');
    const late = await bat.post('/api/applications').send(VALID_FORM);
    expect(late.status).toBe(403);
    expect(late.body.error).toMatch(/2000-01-01-нд дууссан/);

    setSetting('application_deadline', '');
    setSetting('application_start', '2999-01-01');
    const early = await bat.post('/api/applications').send(VALID_FORM);
    expect(early.status).toBe(403);

    setSetting('application_start', '');
    expect((await bat.post('/api/applications').send(VALID_FORM)).status).toBe(201);
  });

  test('TC38: Дүүрсэн болон хүсэлт авахгүй байранд илгээх боломжгүй', async () => {
    const bat = await loginAs(app, 'bat');
    db.prepare('UPDATE dormitories SET capacity = 1 WHERE dorm_id = 1').run();
    db.prepare(
      `INSERT INTO applications (student_id, dorm_id, academic_year, phone, emergency_name, emergency_phone, reason, status)
       VALUES (4, 1, ?, '99000001', 'Болд Дорж', '88000001', 'Орон нутгаас ирсэн оюутан', 'APPROVED')`
    ).run(currentAcademicYear());

    const full = await bat.post('/api/applications').send(VALID_FORM);
    expect(full.status).toBe(400);
    expect(full.body.details.dormId).toBe('Энэ байранд сул ор үлдээгүй байна');

    db.prepare('UPDATE dormitories SET is_active = 0 WHERE dorm_id = 3').run();
    const closed = await bat.post('/api/applications').send({ ...VALID_FORM, dormId: 3 });
    expect(closed.status).toBe(400);
    expect(closed.body.details.dormId).toMatch(/хүсэлт хүлээн авахгүй/);

    const dorms = await bat.get('/api/dormitories');
    expect(dorms.body.dormitories.map((d) => d.name)).toEqual(['1-р байр']);
    expect(dorms.body.dormitories[0]).toMatchObject({ approved: 1, available: 0 });
  });

  test('TC39: URL параметр массив, объект хэлбэрээр ирэхэд 400 буцаана', async () => {
    const staff = await loginAs(app, 'staff');
    expect((await staff.get('/api/admin/applications?status[]=PENDING')).status).toBe(400);
    expect((await staff.get('/api/admin/applications?year=2026')).status).toBe(400);
    expect((await staff.get('/api/admin/applications?sort=DROP TABLE')).status).toBe(400);
  });
});
