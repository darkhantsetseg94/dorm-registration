const request = require('supertest');
const { buildTestApp, loginAs, roomId, submit, VALID_FORM } = require('./helpers');

describe('Ажилтан: хүсэлт шийдвэрлэх, өрөө хуваарилах', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  test('TC40: Оюутан /api/admin/* руу хандах боломжгүй (403)', async () => {
    const bat = await loginAs(app, 'bat');
    for (const url of ['/api/admin/applications', '/api/admin/stats', '/api/admin/users', '/api/admin/settings']) {
      // eslint-disable-next-line no-await-in-loop
      expect((await bat.get(url)).status).toBe(403);
    }
  });

  test('TC41: Зөвшөөрч өрөө хуваарилахад оюутанд мэдэгдэл очиж, төлөв шинэчлэгдэнэ', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    const staff = await loginAs(app, 'staff');

    const res = await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: roomId(db, 1, '101'), note: 'Тавтай морил' });
    expect(res.status).toBe(200);
    expect(res.body.application).toMatchObject({ status: 'APPROVED', roomNumber: '101', staffNote: 'Тавтай морил', reviewerName: 'Дотуур байрны багш' });
    expect(res.body.application.events.map((e) => e.action)).toEqual(['SUBMITTED', 'APPROVED', 'ROOM_ASSIGNED']);

    const notes = await bat.get('/api/notifications');
    expect(notes.body.unread).toBe(1);
    expect(notes.body.notifications[0].title).toBe('Таны хүсэлт зөвшөөрөгдлөө');
    expect(notes.body.notifications[0].body).toMatch(/101 тоот өрөө/);

    const my = await bat.get('/api/applications/my');
    expect(my.body.applications[0]).toMatchObject({ status: 'APPROVED', roomNumber: '101' });

    // Давхар шийдвэрлэхгүй
    expect((await staff.post(`/api/admin/applications/${id}/reject`).send({ note: 'Дахин шалгав' })).status).toBe(409);
  });

  test('TC42: Дүүрсэн өрөөнд хуваарилах боломжгүй', async () => {
    const staff = await loginAs(app, 'staff');
    const room = roomId(db, 1, '101'); // 2 ортой
    for (const key of ['bat', 'tuvshin']) {
      // eslint-disable-next-line no-await-in-loop
      const id = await submit(await loginAs(app, key));
      // eslint-disable-next-line no-await-in-loop
      expect((await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: room })).status).toBe(200);
    }

    // Гурав дахь эрэгтэй оюутан бүртгүүлээд хүсэлт илгээнэ
    const third = request.agent(app);
    await third.post('/api/auth/register').send({
      username: 'B231910050', fullName: 'Мөнх Эрдэнэ', email: 'munkh@test.mn', gender: 'male',
      password: 'Gurav2026pass', passwordConfirm: 'Gurav2026pass',
    });
    const id = await submit(third);
    const res = await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: room });
    expect(res.status).toBe(400);
    expect(res.body.details.roomId).toBe('Өрөө дүүрсэн байна');

    const options = await staff.get(`/api/admin/applications/${id}/rooms`);
    expect(options.body.rooms.find((r) => r.id === room)).toMatchObject({ occupied: 2, fits: false, problem: 'Өрөө дүүрсэн байна' });
    expect(options.body.suggestedRoomId).toBe(roomId(db, 1, '102'));
  });

  test('TC43: Холимог байранд өрөөний хүйсийн дүрмийг мөрдөнө', async () => {
    const staff = await loginAs(app, 'staff');
    const nomin = await loginAs(app, 'nomin'); // эмэгтэй
    const id = await submit(nomin, { dormId: 3 });

    const maleRoom = await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: roomId(db, 3, '301') });
    expect(maleRoom.status).toBe(400);
    expect(maleRoom.body.details.roomId).toBe('Энэ өрөө эрэгтэй оюутанд зориулагдсан');

    // Хүйс заагаагүй өрөөнд эрэгтэй оюутан байвал эмэгтэйг оруулахгүй
    const bat = await loginAs(app, 'bat');
    const batId = await submit(bat, { dormId: 3 });
    await staff.post(`/api/admin/applications/${batId}/approve`).send({ roomId: roomId(db, 3, '302') });
    const mixed = await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: roomId(db, 3, '302') });
    expect(mixed.body.details.roomId).toBe('Өрөөнд өөр хүйсийн оюутан байрлаж байна');

    // Өөр байрны өрөө
    const other = await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: roomId(db, 1, '101') });
    expect(other.body.details.roomId).toBe('Энэ өрөө хүсэлтийн байранд хамаарахгүй');
  });

  test('TC44: Байрны багтаамж дүүрсэн үед зөвшөөрөх боломжгүй (409)', async () => {
    db.prepare('UPDATE dormitories SET capacity = 1 WHERE dorm_id = 1').run();
    const staff = await loginAs(app, 'staff');
    const first = await submit(await loginAs(app, 'bat'));
    const second = await submit(await loginAs(app, 'tuvshin'));
    expect((await staff.post(`/api/admin/applications/${first}/approve`).send({})).status).toBe(200);
    const res = await staff.post(`/api/admin/applications/${second}/approve`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/дүүрсэн/);
  });

  test('TC45: Татгалзахад шалтгаан заавал, оюутанд мэдэгдэл очно', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    const staff = await loginAs(app, 'staff');

    const empty = await staff.post(`/api/admin/applications/${id}/reject`).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.details.note).toBeDefined();

    const res = await staff.post(`/api/admin/applications/${id}/reject`).send({ note: 'Орон нутгийн оюутанд давуу эрх олгов' });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('REJECTED');
    const notes = await bat.get('/api/notifications');
    expect(notes.body.notifications[0]).toMatchObject({ title: 'Таны хүсэлтээс татгалзлаа', body: 'Орон нутгийн оюутанд давуу эрх олгов' });
  });

  test('TC46: Өрөө солих, хуваарилалт цуцлах, шийдвэр буцаах', async () => {
    const id = await submit(await loginAs(app, 'bat'));
    const staff = await loginAs(app, 'staff');
    await staff.post(`/api/admin/applications/${id}/approve`).send({ roomId: roomId(db, 1, '101') });

    const moved = await staff.post(`/api/admin/applications/${id}/room`).send({ roomId: roomId(db, 1, '102') });
    expect(moved.status).toBe(200);
    expect(moved.body.application.roomNumber).toBe('102');

    const removed = await staff.post(`/api/admin/applications/${id}/room`).send({ roomId: null });
    expect(removed.body.application.roomId).toBeNull();

    const reopened = await staff.post(`/api/admin/applications/${id}/reopen`).send({ note: 'Бичиг баримт дутуу' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.application).toMatchObject({ status: 'PENDING', roomId: null, reviewerName: null });
    expect(reopened.body.application.events.map((e) => e.action))
      .toEqual(['SUBMITTED', 'APPROVED', 'ROOM_ASSIGNED', 'ROOM_ASSIGNED', 'ROOM_REMOVED', 'REOPENED']);

    // Хүлээгдэж буй хүсэлтэд өрөө хуваарилахгүй
    expect((await staff.post(`/api/admin/applications/${id}/room`).send({ roomId: roomId(db, 1, '101') })).status).toBe(409);
  });

  test('TC47: Өрөөний санал — хагас дүүрсэн, тохирох өрөөг эхэлж санал болгоно', async () => {
    const staff = await loginAs(app, 'staff');
    const batId = await submit(await loginAs(app, 'bat'));
    await staff.post(`/api/admin/applications/${batId}/approve`).send({ roomId: roomId(db, 1, '102') });

    const tuvId = await submit(await loginAs(app, 'tuvshin'));
    const res = await staff.get(`/api/admin/applications/${tuvId}/rooms`);
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(2);
    expect(res.body.suggestedRoomId).toBe(roomId(db, 1, '102'));
    expect(res.body.rooms.find((r) => r.roomNumber === '102')).toMatchObject({ occupied: 1, fits: true });
  });

  test('TC48: Жагсаалтыг төлөв, байр, нэрээр (кирилл) шүүж, төлөв бүрийн тоог буцаана', async () => {
    const staff = await loginAs(app, 'staff');
    const batId = await submit(await loginAs(app, 'bat'));
    await submit(await loginAs(app, 'saraa'), { dormId: 2 });
    await submit(await loginAs(app, 'tuvshin'), { dormId: 3 });
    await staff.post(`/api/admin/applications/${batId}/approve`).send({});

    const all = await staff.get('/api/admin/applications');
    expect(all.body.total).toBe(3);
    expect(all.body.counts).toMatchObject({ PENDING: 2, APPROVED: 1 });

    const pending = await staff.get('/api/admin/applications?status=PENDING');
    expect(pending.body.applications).toHaveLength(2);

    const byName = await staff.get(`/api/admin/applications?q=${encodeURIComponent('сарангэрэл')}`);
    expect(byName.body.applications.map((a) => a.student.code)).toEqual(['B221910002']);

    const byDorm = await staff.get('/api/admin/applications?dormId=3');
    expect(byDorm.body.applications.map((a) => a.dormName)).toEqual(['3-р байр']);

    const like = await staff.get(`/api/admin/applications?q=${encodeURIComponent('%')}`);
    expect(like.body.total).toBe(0); // % тэмдэгтийг wildcard гэж ойлгохгүй

    const paged = await staff.get('/api/admin/applications?pageSize=2&page=2');
    expect(paged.body).toMatchObject({ page: 2, pages: 2, total: 3 });
    expect(paged.body.applications).toHaveLength(1);
  });

  test('TC49: CSV экспорт — Excel-д зориулсан BOM, CSV injection хамгаалалттай', async () => {
    const bat = await loginAs(app, 'bat');
    await submit(bat, { reason: '=HYPERLINK("http://evil") орон нутгаас ирсэн' });
    const staff = await loginAs(app, 'staff');

    const res = await staff.get('/api/admin/applications/export').buffer(true).parse((r, cb) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', (chunk) => { data += chunk; });
      r.on('end', () => cb(null, data));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.charCodeAt(0)).toBe(0xFEFF);
    expect(res.body).toContain('Бат-Эрдэнэ Ганбаатар');
    expect(res.body).toContain(`"'=HYPERLINK(""http://evil"") орон нутгаас ирсэн"`);
  });

  test('TC50: Хянах самбарын статистик', async () => {
    const staff = await loginAs(app, 'staff');
    const id = await submit(await loginAs(app, 'bat'), { homeProvince: 'Увс', priorityTags: ['rural'] });
    await staff.post(`/api/admin/applications/${id}/approve`).send({});
    await submit(await loginAs(app, 'saraa'), { dormId: 2, homeProvince: 'Увс' });

    const res = await staff.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.status).toMatchObject({ PENDING: 1, APPROVED: 1 });
    expect(res.body.capacity).toBe(470);
    expect(res.body.freeBeds).toBe(469);
    expect(res.body.unassigned).toBe(1);
    expect(res.body.provinces[0]).toEqual({ name: 'Увс', n: 2 });
    expect(res.body.daily).toHaveLength(14);
    expect(res.body.daily[13].count).toBe(2);
    expect(res.body.tags.find((t) => t.key === 'rural').n).toBe(1);
  });

  test('TC51: Ажилтан хүсэлт илгээх API-г ашиглаж чадахгүй, оюутан шийдвэрлэх API-г ашиглаж чадахгүй', async () => {
    const bat = await loginAs(app, 'bat');
    const id = await submit(bat);
    expect((await bat.post(`/api/admin/applications/${id}/approve`).send({})).status).toBe(403);
    const staff = await loginAs(app, 'staff');
    expect((await staff.put(`/api/applications/${id}`).send(VALID_FORM)).status).toBe(403);
  });
});
