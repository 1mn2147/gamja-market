'use client';

import { useParams } from 'next/navigation';
import { ProductDetail } from '../../product-client';

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  return <main><ProductDetail id={params.productId} /></main>;
}
