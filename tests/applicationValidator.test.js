const {
  validateApplication,
  validateApplicationUpdate,
  validateReview,
  parsePositiveInt,
} = require('../src/validators/applicationValidator');
const { currentAcademicYear } = require('../src/services/applicationService');
const { VALID_APPLICATION } = require('./helpers');

describe('parsePositiveInt', () => {
  test('бүхэл эерэг тоог хүлээн авна', () => {
    expect(parsePositiveInt(3)).toBe(3);
    expect(parsePositiveInt('12')).toBe(12);
  });

  test.each([true, [1], 0, -1, 1.5, 'abc', '01', null])(
    'буруу утга %p -> NaN',
    (value) => {
      expect(parsePositiveInt(value)).toBeNaN();
    }
  );
});

describe('validateApplication', () => {
  test('зөв өгөгдөлд алдаагүй', () => {
    const { errors, data } = validateApplication(VALID_APPLICATION);
    expect(errors).toBeNull();
    expect(data).toEqual(VALID_APPLICATION);
  });

  test('хоосон body-д 4 талбарын алдаа', () => {
    const { errors } = validateApplication({});
    expect(Object.keys(errors)).toHaveLength(4);
  });

  test('массив эсвэл null body-г татгалзана', () => {
    expect(validateApplication([]).errors).toHaveProperty('form');
    expect(validateApplication(null).errors).toHaveProperty('form');
  });

  test('8 оронгүй утас татгалзана', () => {
    const { errors } = validateApplication({ ...VALID_APPLICATION, phone: '99112' });
    expect(errors.phone).toBeDefined();
  });

  test('HTML tag агуулсан шалтгааныг татгалзана (XSS)', () => {
    const { errors } = validateApplication({
      ...VALID_APPLICATION,
      reason: '<script>alert(1)</script> байранд суумаар байна',
    });
    expect(errors.reason).toBeDefined();
  });

  test('mass assignment: studentId, status-ийг data-д оруулахгүй', () => {
    const { data } = validateApplication({ ...VALID_APPLICATION, studentId: 2, status: 'APPROVED' });
    expect(data).not.toHaveProperty('studentId');
    expect(data).not.toHaveProperty('status');
  });
});

describe('validateApplicationUpdate (Лаб 11)', () => {
  const current = { ...VALID_APPLICATION };

  test('зөвхөн өгсөн талбарыг сольж, бусдыг хэвээр үлдээнэ', () => {
    const { errors, data, changed } = validateApplicationUpdate({ phone: '95556677' }, current);
    expect(errors).toBeNull();
    expect(changed).toEqual(['phone']);
    expect(data).toMatchObject({ phone: '95556677', reason: current.reason });
  });

  test('яаралтай утсыг өөрийн утастай ижил болгох → алдаа', () => {
    const { errors } = validateApplicationUpdate({ emergencyPhone: current.phone }, current);
    expect(errors).toHaveProperty('emergencyPhone');
  });

  test('зөвшөөрөгдөөгүй талбар л өгвөл → алдаа', () => {
    const { errors } = validateApplicationUpdate({ status: 'APPROVED' }, current);
    expect(errors).toHaveProperty('form');
  });
});

describe('validateReview (Лаб 11)', () => {
  test('APPROVED шалтгаангүй хүлээн авна', () => {
    expect(validateReview({ status: 'approved' }).data).toEqual({ status: 'APPROVED', reviewNote: null });
  });

  test.each([
    [{ status: 'CANCELLED' }, 'status'],
    [{ status: 'REJECTED' }, 'reviewNote'],
    [{ status: 'REJECTED', reviewNote: '<b>no</b>' }, 'reviewNote'],
  ])('%j → %s алдаа', (body, field) => {
    expect(validateReview(body).errors).toHaveProperty(field);
  });
});

describe('currentAcademicYear', () => {
  test.each([
    ['2026-11-11', '2026-2027'],
    ['2026-09-01', '2026-2027'],
    ['2027-03-15', '2026-2027'],
    ['2026-08-31', '2025-2026'],
  ])('%s -> %s', (date, expected) => {
    expect(currentAcademicYear(new Date(`${date}T12:00:00`))).toBe(expected);
  });
});
