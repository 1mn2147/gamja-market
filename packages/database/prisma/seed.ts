import { prisma } from '../src/index.js';

const DEMO_OWNER_ID = 'seed-demo-seller';
const DEMO_OWNER_EMAIL = 'demo-seller@seed.invalid';
// Argon2id hash of a discarded random value. The seed owner exists only to
// satisfy product ownership and has no published or reusable login password.
const DEMO_OWNER_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$zzh/qBx4mf7KKbOqzhXayQ$r6L8lwFvtE5/rte9JZpp1jSOjMIFE6CDhIdgT3Ls4jA';
const DEMO_IMAGE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==', 'base64');

const demoProducts = [
  {
    id: 'seed-product-potato-5kg',
    imageId: 'seed-image-potato-5kg',
    title: '포슬포슬 햇감자 5kg',
    description: '사림동에서 직접 전달하는 테스트용 햇감자입니다. 깨끗하게 선별한 중간 크기 감자 5kg입니다.',
    priceKrw: 15_000n,
    category: '식품',
    altText: '테스트용 햇감자 상품 사진',
  },
  {
    id: 'seed-product-wood-shelf',
    imageId: 'seed-image-wood-shelf',
    title: '원목 3단 수납 선반',
    description: '사용감이 적은 원목 수납 선반입니다. 직거래 시 크기와 상태를 확인할 수 있습니다.',
    priceKrw: 30_000n,
    category: '가구',
    altText: '테스트용 원목 수납 선반 상품 사진',
  },
  {
    id: 'seed-product-keyboard',
    imageId: 'seed-image-keyboard',
    title: '저소음 무선 키보드',
    description: '블루투스 연결과 동글 연결을 지원하는 테스트용 키보드입니다. 키 입력 상태가 정상입니다.',
    priceKrw: 25_000n,
    category: '디지털',
    altText: '테스트용 무선 키보드 상품 사진',
  },
  {
    id: 'seed-product-camping-chair',
    imageId: 'seed-image-camping-chair',
    title: '접이식 캠핑 의자',
    description: '가볍게 휴대할 수 있는 접이식 캠핑 의자입니다. 사림동 직거래 테스트에 사용할 수 있습니다.',
    priceKrw: 18_000n,
    category: '스포츠·레저',
    altText: '테스트용 접이식 캠핑 의자 상품 사진',
  },
] as const;

async function main() {
  const neighborhood = await prisma.neighborhood.upsert({
    where: { code: 'KR-CH-UC-SARIM' },
    update: { name: '사림동' },
    create: { code: 'KR-CH-UC-SARIM', name: '사림동' },
  });

  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: {},
    create: {
      id: DEMO_OWNER_ID,
      email: DEMO_OWNER_EMAIL,
      passwordHash: DEMO_OWNER_PASSWORD_HASH,
      status: 'ACTIVE',
      isAdult: true,
      contactVerifiedAt: new Date('2026-07-23T00:00:00.000Z'),
      neighborhoodId: neighborhood.id,
    },
  });

  for (const [position, product] of demoProducts.entries()) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        authorId: owner.id,
        neighborhoodId: neighborhood.id,
        title: product.title,
        description: product.description,
        priceKrw: product.priceKrw,
        category: product.category,
        status: 'ACTIVE',
        createdAt: new Date(Date.UTC(2026, 6, 23, 8 + position)),
      },
    });
    await prisma.productImage.upsert({
      where: { id: product.imageId },
      update: {},
      create: {
        id: product.imageId,
        productId: product.id,
        mimeType: 'image/png',
        byteSize: DEMO_IMAGE.length,
        altText: product.altText,
        data: DEMO_IMAGE,
        position: 0,
      },
    });
  }
}

void main().finally(() => prisma.$disconnect());
