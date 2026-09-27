import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial military base operational depots...');
  await prisma.auditLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.assetType.deleteMany();
  await prisma.base.deleteMany();

  const northBase = await prisma.base.create({ data: { name: 'Fort Bragg Logistics Hub', location: 'Sector 4 North' } });
  const southBase = await prisma.base.create({ data: { name: 'Camp Pendleton Forward Depot', location: 'Sector 8 South' } });
  const centralBase = await prisma.base.create({ data: { name: 'Omaha Central Armory', location: 'Central Command' } });

  const rifle = await prisma.assetType.create({ data: { name: 'M4A1 Assault Rifle', category: 'WEAPONS' } });
  const humvee = await prisma.assetType.create({ data: { name: 'JLTV Armored Vehicle', category: 'VEHICLES' } });
  const ammo556 = await prisma.assetType.create({ data: { name: '5.56x45mm NATO Box (1000 rds)', category: 'AMMUNITION' } });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password@123', salt);

  await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'General Marcus Vance',
      passwordHash,
      role: 'ADMIN'
    }
  });

  await prisma.user.create({
    data: {
      username: 'commander_north',
      fullName: 'Colonel Sarah Connor',
      passwordHash,
      role: 'BASE_COMMANDER',
      baseId: northBase.id
    }
  });

  await prisma.user.create({
    data: {
      username: 'logistics_south',
      fullName: 'Lieutenant Dan Taylor',
      passwordHash,
      role: 'LOGISTICS_OFFICER',
      baseId: southBase.id
    }
  });

  await prisma.purchase.create({
    data: {
      baseId: northBase.id,
      assetTypeId: rifle.id,
      quantity: 500,
      unitCost: 1200.0,
      vendor: 'Colt Defense',
      timestamp: new Date('2024-01-10')
    }
  });
  await prisma.inventory.create({
    data: { baseId: northBase.id, assetTypeId: rifle.id, quantity: 500 }
  });

  await prisma.purchase.create({
    data: {
      baseId: northBase.id,
      assetTypeId: ammo556.id,
      quantity: 2000,
      unitCost: 450.0,
      vendor: 'Winchester Ammunition',
      timestamp: new Date('2024-01-15')
    }
  });
  await prisma.inventory.create({
    data: { baseId: northBase.id, assetTypeId: ammo556.id, quantity: 2000 }
  });

  await prisma.purchase.create({
    data: {
      baseId: southBase.id,
      assetTypeId: humvee.id,
      quantity: 40,
      unitCost: 185000.0,
      vendor: 'Oshkosh Defense',
      timestamp: new Date('2024-02-01')
    }
  });
  await prisma.inventory.create({
    data: { baseId: southBase.id, assetTypeId: humvee.id, quantity: 40 }
  });

  console.log('Database successfully initialized with authorized officers and base armories.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
