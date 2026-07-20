import { prisma } from '../src/index.js';

async function main() {
  await prisma.neighborhood.upsert({
    where: { code: 'KR-CH-UC-SARIM' },
    update: { name: '사림동' },
    create: { code: 'KR-CH-UC-SARIM', name: '사림동' },
  });
}

void main().finally(() => prisma.$disconnect());
