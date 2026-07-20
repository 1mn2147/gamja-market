'use client';

import { useParams } from 'next/navigation';
import { ProductEditForm } from '../../../product-client';

export default function EditProductPage() {
  const params = useParams<{ productId: string }>();
  return <main><ProductEditForm id={params.productId} /></main>;
}
