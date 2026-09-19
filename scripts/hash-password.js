// استفاده: node scripts/hash-password.js "رمز-دلخواه"
const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("لطفاً رمز عبور را به‌عنوان آرگومان بدهید. مثال:");
  console.error('  node scripts/hash-password.js "MySecret123"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log("این مقدار را در ADMIN_PASSWORD_HASH قرار دهید:\n");
console.log(hash);
