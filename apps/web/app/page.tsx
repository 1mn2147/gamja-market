import Link from 'next/link';
import { ProductFeed } from './product-client';

export default function HomePage() {
  return <main aria-labelledby="home-title"><p style={{ color: 'var(--brand)', fontWeight: 700 }}>감자마켓 · 사림동</p><h1 id="home-title">가까운 동네의 안전한 중고거래</h1><p><Link href="/search">상품 검색</Link> · <Link href="/products/new">상품 등록</Link></p><ProductFeed /></main>;
}
