import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { login, getMe } from './controllers/authController.js';
import { getDashboardMetrics, getMetadata } from './controllers/dashboardController.js';
import { recordPurchase, getPurchases } from './controllers/purchaseController.js';
import { transferAsset, getTransfers } from './controllers/transferController.js';
import { createAssignment, recordExpenditure, getAssignments } from './controllers/assignmentController.js';
import { authenticateToken, authorizeRoles, scopeToBase } from './middleware/authMiddleware.js';
import prisma from './lib/prisma.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getMe);

app.get('/api/metadata', authenticateToken, getMetadata);
app.get('/api/dashboard', authenticateToken, getDashboardMetrics);

app.post('/api/purchases', authenticateToken, authorizeRoles('ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER'), scopeToBase, recordPurchase);
app.get('/api/purchases', authenticateToken, getPurchases);

app.post('/api/transfers', authenticateToken, authorizeRoles('ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER'), transferAsset);
app.get('/api/transfers', authenticateToken, getTransfers);

app.post('/api/assignments', authenticateToken, authorizeRoles('ADMIN', 'BASE_COMMANDER'), scopeToBase, createAssignment);
app.post('/api/assignments/expend', authenticateToken, authorizeRoles('ADMIN', 'BASE_COMMANDER'), recordExpenditure);
app.get('/api/assignments', authenticateToken, getAssignments);

app.get('/api/audit-logs', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { username: true, role: true } } },
    orderBy: { timestamp: 'desc' },
    take: 100
  });
  res.json(logs);
});

app.get('/api/health', (req, res) => res.json({ status: 'MIL-OPS API ACTIVE', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[MIL-OPS] Command API Server running on port ${PORT}`));
