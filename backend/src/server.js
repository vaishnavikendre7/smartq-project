const { port } = require('./config/env');
const prisma = require('./config/prisma');
const app = require('./app');

(async () => {
  try {
    await prisma.$connect();
    console.log('MySQL connected (my_app_db)');
    app.listen(port, () => console.log(`SmartQ API running on http://localhost:${port}`));
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
    console.error('Check DATABASE_URL in backend/.env, that MySQL is running, and that you ran the migration.');
    process.exit(1);
  }
})();
