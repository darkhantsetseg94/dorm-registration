const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const PASSWORD_MAX = 128;

/**
 * Нэвтрэх form-ыг шалгана.
 * - Хоосон талбар → errors (400)
 * - Формат буруу (жишээ нь SQL injection оролдлого) → invalidCredentials (401),
 *   ингэснээр халдагчид ямар шалгалтад баригдсаныг мэдэгдэхгүй.
 */
function validateLogin(body) {
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const errors = {};
  if (!username) errors.username = 'Оюутны код эсвэл нэвтрэх нэрээ оруулна уу';
  if (!password) errors.password = 'Нууц үгээ оруулна уу';
  if (Object.keys(errors).length > 0) return { errors };

  if (!USERNAME_RE.test(username) || password.length > PASSWORD_MAX) {
    return { invalidCredentials: true };
  }
  return { data: { username, password } };
}

module.exports = { validateLogin };
