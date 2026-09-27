import prisma from '../lib/prisma.js';
import { logAudit } from '../middleware/auditMiddleware.js';

export const createAssignment = async (req, res) => {
  const { baseId, assetTypeId, personnelName, personnelRank, quantity } = req.body;
  const qty = parseInt(quantity);

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: { baseId_assetTypeId: { baseId, assetTypeId } }
      });
      if (!inv || inv.quantity < qty) {
        throw new Error(`Insufficient depot stock to fulfill assignment. Available: ${inv?.quantity || 0}`);
      }

      await tx.inventory.update({
        where: { baseId_assetTypeId: { baseId, assetTypeId } },
        data: { quantity: { decrement: qty } }
      });

      return await tx.assignment.create({
        data: {
          baseId,
          assetTypeId,
          personnelName,
          personnelRank,
          quantity: qty,
          isExpended: false
        }
      });
    });

    await logAudit({
      req,
      action: 'ASSIGN_ASSET',
      resourceType: 'ASSIGNMENT',
      resourceId: assignment.id,
      details: { baseId, assetTypeId, personnelName, personnelRank, quantity: qty }
    });

    res.status(201).json({ message: 'Asset assigned successfully', assignment });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const recordExpenditure = async (req, res) => {
  const { assignmentId, reason } = req.body;

  try {
    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        isExpended: true,
        expendedReason: reason || 'Live fire exercise / Operational consumption',
        expendedAt: new Date()
      },
      include: { assetType: true, base: true }
    });

    await logAudit({
      req,
      action: 'EXPEND_ASSET',
      resourceType: 'ASSIGNMENT',
      resourceId: updated.id,
      details: { assignmentId, reason }
    });

    res.json({ message: 'Expenditure logged', assignment: updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getAssignments = async (req, res) => {
  const { baseId, category } = req.query;

  let filter = {};
  if (req.user.role !== 'ADMIN') {
    filter.baseId = req.user.baseId;
  } else if (baseId) {
    filter.baseId = baseId;
  }

  if (category) {
    filter.assetType = { category };
  }

  try {
    const data = await prisma.assignment.findMany({
      where: filter,
      include: { base: true, assetType: true },
      orderBy: { assignedAt: 'desc' }
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
