const { DORM_GENDER_LABELS, GENDER_LABELS } = require('../constants');
const { AppError, notFound, conflict, invalid } = require('../errors');

function dormDto(row) {
  const approved = row.approved ?? 0;
  return {
    id: row.dorm_id,
    name: row.name,
    genderType: row.gender_type,
    genderLabel: DORM_GENDER_LABELS[row.gender_type],
    capacity: row.capacity,
    address: row.address,
    description: row.description,
    monthlyFee: row.monthly_fee,
    isActive: row.is_active === 1,
    approved,
    pending: row.pending ?? 0,
    available: Math.max(row.capacity - approved, 0),
    roomCount: row.room_count ?? 0,
    roomBeds: row.room_beds ?? 0,
    unassigned: row.unassigned ?? 0,
  };
}

function roomDto(row) {
  return {
    id: row.room_id,
    dormId: row.dorm_id,
    roomNumber: row.room_number,
    floor: row.floor,
    capacity: row.capacity,
    gender: row.gender,
    genderLabel: row.gender ? GENDER_LABELS[row.gender] : null,
    occupied: row.occupied ?? 0,
    maleCount: row.male_count ?? 0,
    femaleCount: row.female_count ?? 0,
  };
}

/**
 * Өрөөнд тухайн оюутныг байрлуулж болох эсэх.
 * @returns {string|null}  болохгүй бол шалтгаан
 */
function roomProblem(room, studentGender) {
  if (room.gender && room.gender !== studentGender) {
    return `Энэ өрөө ${GENDER_LABELS[room.gender].toLowerCase()} оюутанд зориулагдсан`;
  }
  const otherGender = studentGender === 'male' ? room.femaleCount : room.maleCount;
  if (otherGender > 0) return 'Өрөөнд өөр хүйсийн оюутан байрлаж байна';
  if (room.occupied >= room.capacity) return 'Өрөө дүүрсэн байна';
  return null;
}

const DORM_STATS_SQL = `
  SELECT d.*,
    (SELECT COUNT(*) FROM applications a
      WHERE a.dorm_id = d.dorm_id AND a.academic_year = @year AND a.status = 'APPROVED') AS approved,
    (SELECT COUNT(*) FROM applications a
      WHERE a.dorm_id = d.dorm_id AND a.academic_year = @year AND a.status = 'PENDING') AS pending,
    (SELECT COUNT(*) FROM applications a
      WHERE a.dorm_id = d.dorm_id AND a.academic_year = @year AND a.status = 'APPROVED' AND a.room_id IS NULL) AS unassigned,
    (SELECT COUNT(*) FROM rooms r WHERE r.dorm_id = d.dorm_id) AS room_count,
    (SELECT COALESCE(SUM(r.capacity), 0) FROM rooms r WHERE r.dorm_id = d.dorm_id) AS room_beds
  FROM dormitories d`;

const ROOM_STATS_SQL = `
  SELECT r.*,
    COUNT(a.application_id) AS occupied,
    COALESCE(SUM(u.gender = 'male'), 0) AS male_count,
    COALESCE(SUM(u.gender = 'female'), 0) AS female_count
  FROM rooms r
  LEFT JOIN applications a ON a.room_id = r.room_id AND a.status = 'APPROVED' AND a.academic_year = @year
  LEFT JOIN users u ON u.user_id = a.student_id`;

function createDormService(db) {
  const stmt = {
    all: db.prepare(`${DORM_STATS_SQL} ORDER BY d.dorm_id`),
    one: db.prepare(`${DORM_STATS_SQL} WHERE d.dorm_id = @id`),
    nameTaken: db.prepare('SELECT dorm_id FROM dormitories WHERE name = ? COLLATE NOCASE AND dorm_id IS NOT ?'),
    insert: db.prepare(
      `INSERT INTO dormitories (name, gender_type, capacity, address, description, monthly_fee, is_active)
       VALUES (@name, @genderType, @capacity, @address, @description, @monthlyFee, @isActive)`
    ),
    update: db.prepare(
      `UPDATE dormitories SET name = @name, gender_type = @genderType, capacity = @capacity, address = @address,
              description = @description, monthly_fee = @monthlyFee, is_active = @isActive
        WHERE dorm_id = @id`
    ),
    remove: db.prepare('DELETE FROM dormitories WHERE dorm_id = ?'),
    applicationCount: db.prepare('SELECT COUNT(*) AS n FROM applications WHERE dorm_id = ?'),
    residentsOfGender: db.prepare(
      `SELECT COUNT(*) AS n FROM applications a JOIN users u ON u.user_id = a.student_id
        WHERE a.dorm_id = ? AND a.academic_year = ? AND a.status = 'APPROVED' AND u.gender = ?`
    ),
    rooms: db.prepare(
      `${ROOM_STATS_SQL} WHERE r.dorm_id = @dormId GROUP BY r.room_id
        ORDER BY r.floor, length(r.room_number), r.room_number`
    ),
    room: db.prepare(`${ROOM_STATS_SQL} WHERE r.room_id = @roomId GROUP BY r.room_id`),
    residents: db.prepare(
      `SELECT a.application_id, a.room_id, u.full_name, u.username, u.gender
         FROM applications a JOIN users u ON u.user_id = a.student_id
        WHERE a.dorm_id = ? AND a.academic_year = ? AND a.status = 'APPROVED'
        ORDER BY u.full_name`
    ),
    roomNumberTaken: db.prepare(
      'SELECT room_id FROM rooms WHERE dorm_id = ? AND room_number = ? COLLATE NOCASE AND room_id IS NOT ?'
    ),
    insertRoom: db.prepare(
      `INSERT INTO rooms (dorm_id, room_number, floor, capacity, gender)
       VALUES (@dormId, @roomNumber, @floor, @capacity, @gender)`
    ),
    insertRoomIgnore: db.prepare(
      `INSERT OR IGNORE INTO rooms (dorm_id, room_number, floor, capacity, gender)
       VALUES (@dormId, @roomNumber, @floor, @capacity, @gender)`
    ),
    updateRoom: db.prepare(
      `UPDATE rooms SET room_number = @roomNumber, floor = @floor, capacity = @capacity, gender = @gender
        WHERE room_id = @roomId`
    ),
    removeRoom: db.prepare('DELETE FROM rooms WHERE room_id = ?'),
  };

  function getDormRow(id, year) {
    const row = stmt.one.get({ id, year });
    if (!row) throw notFound('Байр олдсонгүй');
    return row;
  }

  function getRoom(roomId, year) {
    const row = stmt.room.get({ roomId, year });
    if (!row) throw notFound('Өрөө олдсонгүй');
    return roomDto(row);
  }

  /** Байрны төрөлтэй өрөөний хүйс зөрөхгүй эсэх */
  function checkRoomGenderForDorm(dorm, gender) {
    if (gender && dorm.gender_type !== 'mixed' && gender !== dorm.gender_type) {
      throw invalid({ gender: `${DORM_GENDER_LABELS[dorm.gender_type]} байранд өөр хүйсийн өрөө үүсгэх боломжгүй` });
    }
  }

  const service = {
    roomProblem,

    /** Байрны жагсаалт. Оюутанд зөвхөн идэвхтэй, хүйсэнд тохирох байр харагдана. */
    list(year, user = null) {
      let rows = stmt.all.all({ year });
      if (user && user.role === 'student') {
        rows = rows.filter((d) => d.is_active === 1 && (d.gender_type === 'mixed' || d.gender_type === user.gender));
      }
      return rows.map(dormDto);
    },

    get(id, year) {
      return dormDto(getDormRow(id, year));
    },

    /** Хүсэлт шалгахад хэрэгтэй түүхий мөр */
    getRow(id, year) {
      return stmt.one.get({ id, year }) || null;
    },

    create(data, year) {
      if (stmt.nameTaken.get(data.name, null)) throw conflict('Ийм нэртэй байр бүртгэлтэй байна', { name: 'Ийм нэртэй байр бүртгэлтэй байна' });
      const result = stmt.insert.run({ ...data, isActive: data.isActive ? 1 : 0 });
      return service.get(result.lastInsertRowid, year);
    },

    update(id, data, year) {
      const dorm = getDormRow(id, year);
      if (stmt.nameTaken.get(data.name, id)) throw conflict('Ийм нэртэй байр бүртгэлтэй байна', { name: 'Ийм нэртэй байр бүртгэлтэй байна' });
      if (data.capacity < dorm.approved) {
        throw invalid({ capacity: `Одоо ${dorm.approved} оюутан байрлаж байгаа тул багтаамжийг үүнээс бага болгох боломжгүй` });
      }
      if (data.genderType !== 'mixed') {
        const other = data.genderType === 'male' ? 'female' : 'male';
        if (stmt.residentsOfGender.get(id, year, other).n > 0) {
          throw invalid({ genderType: 'Байранд өөр хүйсийн оюутан байрлаж байгаа тул төрлийг өөрчлөх боломжгүй' });
        }
      }
      stmt.update.run({ ...data, id, isActive: data.isActive ? 1 : 0 });
      return service.get(id, year);
    },

    remove(id) {
      getDormRow(id, '');
      if (stmt.applicationCount.get(id).n > 0) {
        throw conflict('Хүсэлт ирсэн байрыг устгах боломжгүй. Оронд нь "Хүсэлт авахгүй" болгоно уу');
      }
      stmt.remove.run(id);
    },

    /** Өрөөнүүд + тухайн жилд байрлаж буй оюутнууд */
    rooms(dormId, year) {
      const dorm = service.get(dormId, year);
      const residents = stmt.residents.all(dormId, year).map((r) => ({
        applicationId: r.application_id,
        roomId: r.room_id,
        fullName: r.full_name,
        username: r.username,
        gender: r.gender,
      }));
      const rooms = stmt.rooms.all({ dormId, year }).map((row) => ({
        ...roomDto(row),
        residents: residents.filter((r) => r.roomId === row.room_id),
      }));
      return { dorm, rooms, unassigned: residents.filter((r) => r.roomId === null) };
    },

    roomsForDorm(dormId, year) {
      return stmt.rooms.all({ dormId, year }).map(roomDto);
    },

    getRoom,

    createRoom(dormId, data, year) {
      const dorm = getDormRow(dormId, year);
      checkRoomGenderForDorm(dorm, data.gender);
      if (stmt.roomNumberTaken.get(dormId, data.roomNumber, null)) {
        throw conflict('Ийм дугаартай өрөө байна', { roomNumber: 'Ийм дугаартай өрөө энэ байранд байна' });
      }
      const result = stmt.insertRoom.run({ ...data, dormId });
      return getRoom(result.lastInsertRowid, year);
    },

    /** 101…108, 201…208 гэх мэт дугаартай өрөөнүүдийг нэг дор үүсгэнэ. Байгаа дугаарыг алгасна. */
    bulkCreateRooms(dormId, data, year) {
      const dorm = getDormRow(dormId, year);
      checkRoomGenderForDorm(dorm, data.gender);
      let created = 0;
      let skipped = 0;
      db.transaction(() => {
        for (let floor = data.floorFrom; floor <= data.floorTo; floor += 1) {
          for (let i = 1; i <= data.roomsPerFloor; i += 1) {
            const roomNumber = `${floor}${String(i).padStart(2, '0')}`;
            const res = stmt.insertRoomIgnore.run({
              dormId, roomNumber, floor, capacity: data.capacity, gender: data.gender,
            });
            if (res.changes > 0) created += 1;
            else skipped += 1;
          }
        }
      })();
      return { created, skipped };
    },

    updateRoom(roomId, data, year) {
      const room = getRoom(roomId, year);
      const dorm = getDormRow(room.dormId, year);
      checkRoomGenderForDorm(dorm, data.gender);
      if (stmt.roomNumberTaken.get(room.dormId, data.roomNumber, roomId)) {
        throw conflict('Ийм дугаартай өрөө байна', { roomNumber: 'Ийм дугаартай өрөө энэ байранд байна' });
      }
      if (data.capacity < room.occupied) {
        throw invalid({ capacity: `Өрөөнд ${room.occupied} оюутан байрлаж байна` });
      }
      if (data.gender && (data.gender === 'male' ? room.femaleCount : room.maleCount) > 0) {
        throw invalid({ gender: 'Өрөөнд өөр хүйсийн оюутан байрлаж байна' });
      }
      stmt.updateRoom.run({ ...data, roomId });
      return getRoom(roomId, year);
    },

    removeRoom(roomId, year) {
      const room = getRoom(roomId, year);
      if (room.occupied > 0) {
        throw new AppError(409, 'Оюутан байрлаж буй өрөөг устгах боломжгүй. Эхлээд оюутнуудыг өөр өрөөнд шилжүүлнэ үү');
      }
      stmt.removeRoom.run(roomId);
    },
  };
  return service;
}

module.exports = { createDormService, roomProblem };
