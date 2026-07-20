import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma, ProductStatus } from '@gamja/database';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import type { CreateProductDto, ProductImageDto, ProductQueryDto, UpdateProductDto } from './product.dto.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const INITIAL_NEIGHBORHOOD_CODE = 'KR-CH-UC-SARIM';

type ProductRecord = Prisma.ProductGetPayload<{
  include: { neighborhood: { select: { code: true; name: true } }; images: { select: { id: true; altText: true; mimeType: true; position: true } } };
}>;

@Injectable()
export class ProductService {
  private imageMime(buffer: Buffer): string | undefined {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return undefined;
  }

  private imagesForStorage(images: ProductImageDto[]) {
    return images.map((image, position) => {
      const buffer = Buffer.from(image.dataBase64, 'base64');
      const mimeType = this.imageMime(buffer);
      if (!mimeType || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        throw new BadRequestException({ code: 'INVALID_IMAGE' });
      }
      return { data: buffer, byteSize: buffer.length, mimeType, altText: image.altText.trim(), position };
    });
  }

  private serialize(product: ProductRecord) {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      priceKrw: product.priceKrw.toString(),
      category: product.category,
      status: product.status,
      neighborhood: product.neighborhood,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      images: product.images.map((image) => ({ id: image.id, altText: image.altText, mimeType: image.mimeType, url: `/api/v1/products/${product.id}/images/${image.id}` })),
    };
  }

  private async ensureNeighborhood(user: AuthenticatedUser) {
    const code = user.neighborhood?.code ?? INITIAL_NEIGHBORHOOD_CODE;
    const neighborhood = await prisma.neighborhood.findUnique({ where: { code } });
    if (!neighborhood) throw new ForbiddenException({ code: 'NEIGHBORHOOD_NOT_AVAILABLE' });
    return neighborhood;
  }

  private async ownedProduct(id: string, userId: string) {
    const product = await prisma.product.findFirst({
      where: { id, authorId: userId, status: { not: ProductStatus.DELETED } },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' } } },
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    return product;
  }

  async create(user: AuthenticatedUser, input: CreateProductDto) {
    const neighborhood = await this.ensureNeighborhood(user);
    const images = this.imagesForStorage(input.images);
    const product = await prisma.product.create({
      data: {
        authorId: user.id,
        neighborhoodId: neighborhood.id,
        title: input.title.trim(),
        description: input.description.trim(),
        priceKrw: BigInt(input.priceKrw),
        category: input.category.trim(),
        images: { create: images },
      },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' } } },
    });
    return this.serialize(product);
  }

  async update(id: string, user: AuthenticatedUser, input: UpdateProductDto) {
    const existing = await this.ownedProduct(id, user.id);
    if (existing.status === ProductStatus.RESERVED) throw new ConflictException({ code: 'PRODUCT_LOCKED_BY_ACTIVE_TRADE' });
    const product = await prisma.product.update({
      where: { id },
      data: { ...(input.title ? { title: input.title.trim() } : {}), ...(input.description ? { description: input.description.trim() } : {}), ...(input.priceKrw ? { priceKrw: BigInt(input.priceKrw) } : {}), ...(input.category ? { category: input.category.trim() } : {}) },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' } } },
    });
    return this.serialize(product);
  }

  async setStatus(id: string, user: AuthenticatedUser, status: 'ACTIVE' | 'HIDDEN') {
    await this.ownedProduct(id, user.id);
    const product = await prisma.product.update({
      where: { id }, data: { status },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' } } },
    });
    return this.serialize(product);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.ownedProduct(id, user.id);
    if (existing.status === ProductStatus.RESERVED) throw new ConflictException({ code: "PRODUCT_LOCKED_BY_ACTIVE_TRADE" });
    await prisma.product.update({ where: { id }, data: { status: ProductStatus.DELETED } });
  }

  async detail(id: string, user?: AuthenticatedUser) {
    const product = await prisma.product.findFirst({
      where: { id, status: { not: ProductStatus.DELETED }, OR: [{ status: ProductStatus.ACTIVE }, ...(user ? [{ authorId: user.id }] : [])] },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' } } },
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    return this.serialize(product);
  }

  private decodeCursor(value: string | undefined) {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { id?: string };
      return typeof parsed.id === 'string' ? parsed.id : undefined;
    } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
  }

  async list(query: ProductQueryDto, user?: AuthenticatedUser) {
    const neighborhood = await this.ensureNeighborhood(user ?? { id: '', email: null, phone: null, role: 'USER', status: 'ACTIVE', neighborhood: null });
    const accessibleIds = [neighborhood.id, ...(await prisma.neighborhoodLink.findMany({ where: { fromId: neighborhood.id }, select: { toId: true } })).map((link) => link.toId)];
    const search = query.query?.trim();
    const matchingIds = search ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p.id FROM "Product" p
      WHERE p."status" = 'ACTIVE'
        AND p."neighborhoodId" IN (${Prisma.join(accessibleIds)})
        AND to_tsvector('simple', coalesce(p."title", '') || ' ' || coalesce(p."description", '')) @@ websearch_to_tsquery('simple', ${search})
    `) : undefined;
    if (matchingIds && matchingIds.length === 0) return { products: [], nextCursor: null };
    const cursor = this.decodeCursor(query.cursor);
    const sort = query.sort ?? 'latest';
    const orderBy = sort === 'price_asc' ? [{ priceKrw: 'asc' as const }, { id: 'asc' as const }] : sort === 'price_desc' ? [{ priceKrw: 'desc' as const }, { id: 'desc' as const }] : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    const limit = Number(query.limit ?? 20);
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        neighborhoodId: { in: accessibleIds },
        ...(matchingIds ? { id: { in: matchingIds.map((row) => row.id) } } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.minPrice || query.maxPrice ? { priceKrw: { ...(query.minPrice ? { gte: BigInt(query.minPrice) } : {}), ...(query.maxPrice ? { lte: BigInt(query.maxPrice) } : {}) } } : {}),
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy,
      take: limit + 1,
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' }, take: 1 } },
    });
    const hasMore = products.length > limit;
    if (hasMore) products.pop();
    const last = hasMore ? products.at(-1) : undefined;
    return { products: products.map((product) => this.serialize(product)), nextCursor: last ? Buffer.from(JSON.stringify({ id: last.id })).toString('base64url') : null };
  }

  async mine(user: AuthenticatedUser) {
    const products = await prisma.product.findMany({
      where: { authorId: user.id, status: { not: ProductStatus.DELETED } }, orderBy: { createdAt: 'desc' },
      include: { neighborhood: { select: { code: true, name: true } }, images: { select: { id: true, altText: true, mimeType: true, position: true }, orderBy: { position: 'asc' }, take: 1 } },
    });
    return { products: products.map((product) => this.serialize(product)) };
  }

  async image(productId: string, imageId: string, user?: AuthenticatedUser) {
    const product = await prisma.product.findFirst({ where: { id: productId, status: { not: ProductStatus.DELETED }, OR: [{ status: ProductStatus.ACTIVE }, ...(user ? [{ authorId: user.id }] : [])] }, select: { id: true } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId }, select: { data: true, mimeType: true } });
    if (!image) throw new NotFoundException({ code: 'IMAGE_NOT_FOUND' });
    return image;
  }
}
