const request = require('supertest');
const { buildTestApp, loginAs, roomId, submit, PASSWORD } = require('./helpers');

describe('Ажилтан: байр, өрөө, хэрэглэгч, мэдээлэл, тохиргоо', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  const DORM = {
    name: '4-р байр', genderType: 'mixed', capacity: 80, monthlyFee: 95000, address: 'Хан-Уул дүүрэг', description: 'Шинэ байр',
  };

  test('TC52: Байр нэмэх, засах; давхардсан нэр 409', async () => {
    const staff = await loginAs(app, 'staff');
    const created = await staff.post('/api/admin/dorms').send(DORM);
    expect(created.status).toBe(201);
    expect(created.body.dorm).toMatchObject({ name: '4-р байр', capacity: 80, monthlyFee: 95000, isActive: true });

    expect((await staff.post('/api/admin/dorms').send(DORM)).status).toBe(409);

    const updated = await staff.put(`/api/admin/dorms/${created.body.dorm.id}`).send({ ...DORM, capacity: 90, isActive: false });
    expect(updated.body.dorm).toMatchObject({ capacity: 90, isActive: false });

    // Идэвхгүй байр оюутанд харагдахгүй
    const bat = await loginAs(app, 'bat');
    expect((await bat.get('/api/dormitories')).body.dormitories.map((d) => d.name)).not.toContain('4-р байр');
  });

  test('TC53: Байрлаж буй оюутнаас бага багтаамж, өөр хүйсийн төрөл болгох боломжгүй', async () => {
    const staff = await loginAs(app, 'staff');
    const id = await submit(await loginAs(app, 'bat'), { dormId: 3 });
    await staff.post(`/api/admin/applications/${id}/approve`).send({});

    const dorm = { name: '3-р байр', genderType: 'mixed', capacity: 200 };
    const small = await staff.put('/api/admin/dorms/3').send({ ...dorm, capacity: 0 });
    expect(small.body.details.capacity).toBeDefined();
    const female = await staff.put('/api/admin/dorms/3').send({ ...dorm, genderType: 'female' });
    expect(female.status).toBe(400);
    expect(female.body.details.genderType).toMatch(/өөр хүйсийн/);
  });

  test('TC54: Хүсэлттэй байрыг устгах боломжгүй, хоосон байрыг устгана', async () => {
    const staff = await loginAs(app, 'staff');
    await submit(await loginAs(app, 'bat'));
    expect((await staff.delete('/api/admin/dorms/1')).status).toBe(409);

    const created = await staff.post('/api/admin/dorms').send(DORM);
    expect((await staff.delete(`/api/admin/dorms/${created.body.dorm.id}`)).status).toBe(200);
  });

  test('TC55: Олон өрөө нэг дор үүсгэнэ, байгаа дугаарыг алгасна', async () => {
    const staff = await loginAs(app, 'staff');
    const res = await staff.post('/api/admin/dorms/1/rooms/bulk')
      .send({ floorFrom: 1, floorTo: 2, roomsPerFloor: 3, capacity: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 4, skipped: 2 }); // 101, 102 аль хэдийн байсан

    const rooms = await staff.get('/api/admin/dorms/1/rooms');
    expect(rooms.body.rooms.map((r) => r.roomNumber)).toEqual(['101', '102', '103', '201', '202', '203']);

    // Эрэгтэй байранд эмэгтэй өрөө үүсгэхгүй
    const wrong = await staff.post('/api/admin/dorms/1/rooms').send({ roomNumber: '999', floor: 9, capacity: 2, gender: 'female' });
    expect(wrong.status).toBe(400);
  });

  test('TC56: Оюутан байрлаж буй өрөөг устгах, багтаамжийг бууруулах боломжгүй', async () => {
    const staff = await loginAs(app, 'staff');
    const id = await submit(await loginAs(app, 'bat'));
    const room = roomId(db, 1, '101');
    await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: room });

    expect((await staff.delete(`/api/admin/rooms/${room}`)).status).toBe(409);
    const smaller = await staff.put(`/api/admin/rooms/${room}`).send({ roomNumber: '101', floor: 1, capacity: 0 });
    expect(smaller.status).toBe(400);

    const rooms = await staff.get('/api/admin/dorms/1/rooms');
    expect(rooms.body.rooms[0].residents.map((r) => r.username)).toEqual(['B221910001']);

    expect((await staff.delete(`/api/admin/rooms/${roomId(db, 1, '102')}`)).status).toBe(200);
  });

  test('TC57: Ажилтан хэрэглэгч нэмэх, идэвхгүй болгох, нууц үг шинэчлэх', async () => {
    const staff = await loginAs(app, 'staff');
    const created = await staff.post('/api/admin/users').send({
      role: 'staff', username: 'staff02', fullName: 'Оюунчимэг Бат', email: 'staff02@test.mn',
      gender: 'female', password: 'Ajiltan2026', passwordConfirm: 'Ajiltan2026',
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ role: 'staff', username: 'staff02' });

    const list = await staff.get(`/api/admin/users?q=${encodeURIComponent('оюунчимэг')}`);
    expect(list.body.users.map((u) => u.username)).toEqual(['staff02']);

    // Оюутныг идэвхгүй болгоход нэвтэрсэн session нь устна
    const bat = await loginAs(app, 'bat');
    const batRow = db.prepare("SELECT user_id FROM users WHERE username = 'B221910001'").get();
    const off = await staff.put(`/api/admin/users/${batRow.user_id}`)
      .send({ fullName: 'Бат-Эрдэнэ Ганбаатар', email: 'bat@test.mn', gender: 'male', isActive: false });
    expect(off.status).toBe(200);
    expect((await bat.get('/api/auth/me')).status).toBe(401);

    // Өөрийгөө идэвхгүй болгохгүй
    const self = await staff.put('/api/admin/users/3')
      .send({ fullName: 'Дотуур байрны багш', email: 'staff@test.mn', gender: 'female', isActive: false });
    expect(self.status).toBe(400);

    const reset = await staff.post('/api/admin/users/2/password').send({ password: 'Reset2026pass', passwordConfirm: 'Reset2026pass' });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 'B221910002', password: PASSWORD })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 'B221910002', password: 'Reset2026pass' })).status).toBe(200);
  });

  test('TC58: Мэдээлэл нийтлэх — хүлээн авагчаар шүүгдэнэ, оюутан нийтэлж чадахгүй', async () => {
    const staff = await loginAs(app, 'staff');
    await staff.post('/api/admin/announcements').send({ title: 'Оюутнуудад', body: 'Төлбөрөө төлнө үү', audience: 'student', isPinned: true });
    await staff.post('/api/admin/announcements').send({ title: 'Ажилтнуудад', body: 'Хурал 14:00 цагт', audience: 'staff' });

    const bat = await loginAs(app, 'bat');
    const list = await bat.get('/api/announcements');
    expect(list.body.announcements.map((a) => a.title)).toEqual(['Оюутнуудад']);
    expect((await bat.post('/api/admin/announcements').send({ title: 'Хакер', body: 'тест тест' })).status).toBe(403);

    const xss = await staff.post('/api/admin/announcements').send({ title: 'Туршилт', body: '<script>alert(1)</script>' });
    expect(xss.status).toBe(400);
  });

  test('TC59: Тохиргоо хадгалах — эцсийн хугацаа эхлэх огнооноос өмнө байж болохгүй', async () => {
    const staff = await loginAs(app, 'staff');
    const bad = await staff.put('/api/admin/settings').send({
      applicationsOpen: true, registrationOpen: true, applicationStart: '2026-09-01', applicationDeadline: '2026-08-01',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.details.applicationDeadline).toBeDefined();

    const invalidDate = await staff.put('/api/admin/settings').send({
      applicationsOpen: true, registrationOpen: true, applicationStart: '2026-02-30', applicationDeadline: '',
    });
    expect(invalidDate.body.details.applicationStart).toBeDefined();

    const ok = await staff.put('/api/admin/settings').send({
      applicationsOpen: false, registrationOpen: false, applicationStart: '', applicationDeadline: '2099-12-31',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.window).toMatchObject({ open: false, deadline: '2099-12-31' });
  });
});
