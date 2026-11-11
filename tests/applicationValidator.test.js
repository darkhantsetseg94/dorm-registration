const {
  validateApplication,
  parsePositiveInt,
} = require('../src/validators/applicationValidator');
const { currentAcademicYear } = require('../src/services/applicationService');
const { VALID_APPLICATION } = require('./helpers');

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : NaN;
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
    expect(data.dormId).toBe(1);
  });

  test('хоосон body-д 5 талбарын алдаа', () => {
    const { errors } = validateApplication({});
    expect(Object.keys(errors)).toHaveLength(5);
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
