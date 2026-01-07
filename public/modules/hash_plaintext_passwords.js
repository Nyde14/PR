
require('dotenv').config();

const bcrypt = require('bcryptjs');
const ConnectDB = require('./connectdb');
const User = require('./User');

(async () => {
  await ConnectDB();

  try {
    // Finds passwords in the database that is still in plain text
    const users = await User.find({ password: { $not: /^\$2/ } });

    if (!users.length) {
      console.log('No plaintext passwords found. Nothing to do.');
      process.exit(0);
    }

    let count = 0;
    for (const u of users) {
      const current = u.password;
      if (!current) continue;

      console.log(`Hashing password for ${u.email}`);
      const newHash = await bcrypt.hash(current, 10);
      u.password = newHash;
      await u.save();
      count += 1;
      console.log(`Updated ${u.email}`);
    }

    console.log(`Hashed ${count} user(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Error while hashing passwords:', err);
    process.exit(1);
  }
})();
