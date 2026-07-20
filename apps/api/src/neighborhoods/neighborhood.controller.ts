import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { prisma } from '@gamja/database';

@Controller('neighborhoods')
export class NeighborhoodController {
  @Get()
  async list() {
    const neighborhoods = await prisma.neighborhood.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } });
    return { neighborhoods };
  }

  @Get(':code/nearby')
  async nearby(@Param('code') code: string) {
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { code },
      select: {
        code: true,
        name: true,
        neighborsFrom: { select: { to: { select: { code: true, name: true } } } },
      },
    });
    if (!neighborhood) throw new NotFoundException({ code: 'NEIGHBORHOOD_NOT_FOUND' });
    return {
      neighborhoods: [
        { code: neighborhood.code, name: neighborhood.name },
        ...neighborhood.neighborsFrom.map((link) => link.to),
      ],
    };
  }
}
