import prisma from '../lib/prisma.js';
import { logAudit } from '../middleware/auditMiddleware.js';

export const transferAsset = async (req, res) => {
  const { originBaseId, destinationBaseId, assetTypeId, quantity, reason } = req.body;
  const qty = parseInt(quantity);

  if (!originBaseId || !destinationBaseId || !assetTypeId || qty <= 0) {
    return res.status(400).json({ message: 'Invalid payload: Origin, Destination, Asset, and positive Qty required' });
  }

  if (originBaseId === destinationBaseId) {
    return res.status(400).json({ message: 'Origin and destination bases cannot be identical' });
  }

  if (req.user.role === 'BASE_COMMANDER' && req.user.baseId !== originBaseId) {
    return res.status(403).json({ message: 'Access Denied: You may only transfer assets originating from your base' });
  }

  try {
    const transferRecord = await prisma.$transaction(async (tx) => {
      const originInventory = await tx.inventory.findUnique({
        where: { baseId_assetTypeId: { baseId: originBaseId, assetTypeId } }
      });

      if (!originInventory || originInventory.quantity < qty) {
        throw new Error(`Insufficient inventory at origin base. In depot: ${originInventory?.quantity || 0}`);
      }

      await tx.inventory.update({
        where: { baseId_assetTypeId: { baseId: originBaseId, assetTypeId } },
        data: { quantity: { decrement: qty } }
      });

      await tx.inventory.upsert({
        where: { baseId_assetTypeId: { baseId: destinationBaseId, assetTypeId } },
        update: { quantity: { increment: qty } },
        create: { baseId: destinationBaseId, assetTypeId, quantity: qty }
      });

      return await tx.transfer.create({
        data: {
          originBaseId,
          destinationBaseId,
          assetTypeId,
          quantity: qty,
          reason: reason || 'Tactical Asset Relocation'
        }
      });
    });

    await logAudit({
      req,
      action: 'TRANSFER_ASSET',
      resourceType: 'TRANSFER',
      resourceId: transferRecord.id,
      details: { originBaseId, destinationBaseId, assetTypeId, quantity: qty, reason }
    });

    res.status(201).json({ message: 'Asset transferred with atomic transaction verification', transfer: transferRecord });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTransfers = async (req, res) => {
  const { baseId, category, startDate, endDate } = req.query;

  let filter = {};
  if (req.user.role !== 'ADMIN') {
    filter.OR = [
      { originBaseId: req.user.baseId },
      { destinationBaseId: req.user.baseId }
    ];
  } else if (baseId) {
    filter.OR = [
      { originBaseId: baseId },
      { destinationBaseId: baseId }
    ];
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
    const transfers = await prisma.transfer.findMany({
      where: filter,
      include: { originBase: true, destinationBase: true, assetType: true },
      orderBy: { timestamp: 'desc' }
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
