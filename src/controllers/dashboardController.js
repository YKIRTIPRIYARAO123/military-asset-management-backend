import prisma from '../lib/prisma.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    const { baseId, category, startDate, endDate } = req.query;
    const targetBaseId = req.user.role !== 'ADMIN' ? req.user.baseId : (baseId || undefined);

    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate) : new Date();

    const assetFilter = category ? { category } : {};

    const purchasesWindow = await prisma.purchase.findMany({
      where: {
        timestamp: { gte: start, lte: end },
        ...(targetBaseId ? { baseId: targetBaseId } : {}),
        assetType: assetFilter
      },
      include: { base: true, assetType: true }
    });

    const transfersInWindow = await prisma.transfer.findMany({
      where: {
        timestamp: { gte: start, lte: end },
        ...(targetBaseId ? { destinationBaseId: targetBaseId } : {}),
        assetType: assetFilter
      },
      include: { originBase: true, destinationBase: true, assetType: true }
    });

    const transfersOutWindow = await prisma.transfer.findMany({
      where: {
        timestamp: { gte: start, lte: end },
        ...(targetBaseId ? { originBaseId: targetBaseId } : {}),
        assetType: assetFilter
      },
      include: { originBase: true, destinationBase: true, assetType: true }
    });

    const assignmentsWindow = await prisma.assignment.findMany({
      where: {
        assignedAt: { gte: start, lte: end },
        ...(targetBaseId ? { baseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const expendedWindow = await prisma.assignment.findMany({
      where: {
        isExpended: true,
        expendedAt: { gte: start, lte: end },
        ...(targetBaseId ? { baseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const totalPurchases = purchasesWindow.reduce((acc, p) => acc + p.quantity, 0);
    const totalTransferIn = transfersInWindow.reduce((acc, t) => acc + t.quantity, 0);
    const totalTransferOut = transfersOutWindow.reduce((acc, t) => acc + t.quantity, 0);
    const netMovement = totalPurchases + totalTransferIn - totalTransferOut;

    const totalAssigned = assignmentsWindow.filter(a => !a.isExpended).reduce((acc, a) => acc + a.quantity, 0);
    const totalExpended = expendedWindow.reduce((acc, a) => acc + a.quantity, 0);

    const priorPurchases = await prisma.purchase.aggregate({
      _sum: { quantity: true },
      where: {
        timestamp: { lt: start },
        ...(targetBaseId ? { baseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const priorTransfersIn = await prisma.transfer.aggregate({
      _sum: { quantity: true },
      where: {
        timestamp: { lt: start },
        ...(targetBaseId ? { destinationBaseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const priorTransfersOut = await prisma.transfer.aggregate({
      _sum: { quantity: true },
      where: {
        timestamp: { lt: start },
        ...(targetBaseId ? { originBaseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const priorExpended = await prisma.assignment.aggregate({
      _sum: { quantity: true },
      where: {
        isExpended: true,
        expendedAt: { lt: start },
        ...(targetBaseId ? { baseId: targetBaseId } : {}),
        assetType: assetFilter
      }
    });

    const openingBalance = 
      (priorPurchases._sum.quantity || 0) + 
      (priorTransfersIn._sum.quantity || 0) - 
      (priorTransfersOut._sum.quantity || 0) - 
      (priorExpended._sum.quantity || 0);

    const closingBalance = openingBalance + netMovement - totalExpended;

    res.json({
      metrics: {
        openingBalance,
        closingBalance,
        netMovement,
        totalPurchases,
        totalTransferIn,
        totalTransferOut,
        totalAssigned,
        totalExpended
      },
      drillDown: {
        purchases: purchasesWindow,
        transfersIn: transfersInWindow,
        transfersOut: transfersOutWindow
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMetadata = async (req, res) => {
  try {
    const bases = await prisma.base.findMany({ select: { id: true, name: true, location: true } });
    const assets = await prisma.assetType.findMany();
    res.json({ bases, assets, categories: ['WEAPONS', 'VEHICLES', 'AMMUNITION'] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
