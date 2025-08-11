const { sequelize } = require('../models');
const supabase = require('../services/supabaseService');

async function migrate() {
  const [users] = await sequelize.query('SELECT id, email, password, name FROM users');
  for (const user of users) {
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password || Math.random().toString(36).slice(2, 10),
        email_confirm: true,
        user_metadata: { name: user.name }
      });
      if (error) {
        console.error(`Failed to migrate ${user.email}:`, error.message);
      } else {
        console.log(`Migrated ${user.email}`);
      }
    } catch (err) {
      console.error(`Error migrating ${user.email}:`, err.message);
    }
  }
  await sequelize.close();
}

migrate().then(() => process.exit());
