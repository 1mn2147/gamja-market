import Link from 'next/link';
import { MyProducts } from '../../product-client';

export default function MyProductsPage() { return <main><h1>내 상품 관리</h1><p><Link href="/products/new">새 상품 등록</Link></p><MyProducts /></main>; }
