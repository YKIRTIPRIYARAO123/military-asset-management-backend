import prisma from '../lib/prisma.js';
import { logAudit } from '../middleware/auditMiddleware.js';

export const recordPurchase = async (req, res) => {
  const { baseId, assetTypeId, quantity, unitCost, vendor } = req.body;

  if (!baseId || !assetTypeId || !quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Valid Base, Asset, and positive Quantity are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          baseId,
          assetTypeId,
          quantity: parseInt(quantity),
          unitCost: parseFloat(unitCost || 0),
          vendor: vendor || 'Central Military Procurement'
        }
      });

      await tx.inventory.upsert({
        where: { baseId_assetTypeId: { baseId, assetTypeId } },
        update: { quantity: { increment: parseInt(quantity) } },
        create: { baseId, assetTypeId, quantity: parseInt(quantity) }
      });

      return purchase;
    });

    await logAudit({
      req,
      action: 'RECORD_PURCHASE',
      resourceType: 'PURCHASE',
      resourceId: result.id,
      details: { baseId, assetTypeId, quantity, unitCost, vendor }
    });

    res.status(201).json({ message: 'Purchase logged and depot inventory updated', purchase: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPurchases = async (req, res) => {
  const { baseId, category, startDate, endDate } = req.query;

  let filter = {};
  if (req.user.role !== 'ADMIN') {
    filter.baseId = req.user.baseId;
  } else if (baseId) {
    filter.baseId = baseId;
  }

  if (category) {
    filter.assetType = { category };
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.gte = new Date(startDate);
    if (endDate) filter.timestamp.lte = new Date(endDate);
  }

  try {
    const purchases = await prisma.purchase.findMany({
      where: filter,
      include: { base: true, assetType: true },
      orderBy: { timestamp: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
