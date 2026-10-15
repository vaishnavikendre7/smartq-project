// One shared Prisma client. Prisma talks to MySQL for us.
const { PrismaClient } = require('@prisma/client');
module.exports = new PrismaClient();
