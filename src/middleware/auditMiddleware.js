import prisma from '../lib/prisma.js';

export const logAudit = async ({ req, action, resourceType, resourceId = null, details = {} }) => {
  try {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        details,
        ipAddress: String(ipAddress),
      }
    });
  } catch (err) {
    console.error('Audit Logging Exception:', err.message);
  }
};
