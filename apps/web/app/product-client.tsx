'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

type Product = {
  id: string;
  title: string;
  description: string;
  priceKrw: string;
  category: string;
  status: string;
  neighborhood: { code: string; name: string };
  images: Array<{ id: string; altText: string; url: string }>;
};

type ProductList = { products: Product[]; nextCursor: string | null };

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body) { options.headers = { 'content-type': 'application/json' }; options.body = JSON.stringify(body); }
  const response = await fetch(`${apiOrigin}/api/v1${path}`, options);
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(result.code ?? 'REQUEST_FAILED');
  return result;
}

function price(value: string) { return `${Number(value).toLocaleString('ko-KR')}원`; }


function ProductCard({ product, mine = false, onHidden }: { product: Product; mine?: boolean; onHidden?: () => void }) {
  async function hide() { await api(`/products/${product.id}/status`, 'PATCH', { status: 'HIDDEN' }); onHidden?.(); }
  return (
    <article className="product-card">
      <Link href={`/products/${product.id}`}><img src={`${apiOrigin}${product.images[0]?.url ?? ''}`} alt={product.images[0]?.altText ?? ''} /><h2>{product.title}</h2></Link>
      <p>{price(product.priceKrw)} · {product.neighborhood.name}</p><p>{product.category} · {product.status}</p>
      {mine && <><Link href={`/products/${product.id}/edit`}>수정</Link><button type="button" onClick={() => void hide()}>숨기기</button></>}
    </article>
  );
}
export function ProductFeed({ query = '' }: { query?: string }) {
  const [result, setResult] = useState<ProductList>({ products: [], nextCursor: null });
  const [message, setMessage] = useState('상품을 불러오는 중입니다.');
  useEffect(() => { void api<ProductList>(`/products${query ? `?${query}` : ''}`).then((data) => { setResult(data); setMessage(data.products.length ? '' : '표시할 상품이 없습니다.'); }).catch(() => setMessage('상품을 불러올 수 없습니다.')); }, [query]);
  return <section aria-live="polite"><p>{message}</p><div className="product-grid">{result.products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>;
}

async function toBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  for (const value of new Uint8Array(buffer)) binary += String.fromCharCode(value);
  return btoa(binary);
}

export function ProductCreateForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll('images').filter((value): value is File => value instanceof File && value.size > 0);
    try {
      const images = await Promise.all(files.map(async (file) => ({ dataBase64: await toBase64(file), altText: String(form.get(`alt-${file.name}`) || `${file.name} 상품 사진`) })));
      const product = await api<Product>('/products', 'POST', { title: form.get('title'), description: form.get('description'), priceKrw: form.get('priceKrw'), category: form.get('category'), images });
      window.location.assign(`/products/${product.id}`);
    } catch (error) { setMessage(error instanceof Error ? '상품을 등록할 수 없습니다. 이미지·입력 값을 확인해 주세요.' : '상품을 등록할 수 없습니다.'); }
  }
  return <form onSubmit={submit}><label>제목<input name="title" required maxLength={100} /></label><label>설명<textarea name="description" required maxLength={2000} /></label><label>가격(원)<input name="priceKrw" inputMode="numeric" pattern="[0-9]+" required /></label><label>카테고리<input name="category" required maxLength={50} /></label><label>사진 (PNG, JPEG, WebP / 최대 5장)<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple required /></label><p>상품은 사림동에만 게시되며 상세 주소는 수집·표시하지 않습니다.</p><button type="submit">상품 등록</button><p role="status">{message}</p></form>;
}

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product>();
  const [tradeMessage, setTradeMessage] = useState('');
  const [message, setMessage] = useState('상품을 불러오는 중입니다.');
  useEffect(() => { void api<Product>(`/products/${id}`).then((data) => { setProduct(data); setMessage(''); }).catch(() => setMessage('상품을 찾을 수 없습니다.')); }, [id]);
  async function requestTrade() {
    try {
      const trade = await api<{ id: string }>('/trades', 'POST', { productId: id });
      window.location.assign(`/trades/${trade.id}`);
    } catch {
      setTradeMessage('거래를 요청할 수 없습니다. 로그인·지역·상품 상태를 확인해 주세요.');
    }
  }
  if (!product) return <><h1>상품 상세</h1><p role="status">{message}</p></>;
  return <article><h1>{product.title}</h1>{product.images.map((image) => <img className="product-image" key={image.id} src={`${apiOrigin}${image.url}`} alt={image.altText} />)}<p>{price(product.priceKrw)}</p><p>거래 지역: {product.neighborhood.name}</p><p>{product.description}</p><p>{product.category} · {product.status}</p>{product.status === 'ACTIVE' && <button type="button" onClick={() => void requestTrade()}>판매자에게 거래 요청</button>}<p role="status">{tradeMessage}</p></article>;
}

export function MyProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('내 상품을 불러오는 중입니다.');
  const reload = () => { void api<{ products: Product[] }>('/products/me').then((data) => { setProducts(data.products); setMessage(data.products.length ? '' : '등록한 상품이 없습니다.'); }).catch(() => setMessage('로그인이 필요합니다.')); };
  useEffect(reload, []);
  return <section><p role="status">{message}</p><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} mine onHidden={reload} />)}</div></section>;
}

export function ProductEditForm({ id }: { id: string }) {
  const [product, setProduct] = useState<Product>();
  const [message, setMessage] = useState('상품을 불러오는 중입니다.');
  useEffect(() => { void api<Product>(`/products/${id}`).then((data) => { setProduct(data); setMessage(''); }).catch(() => setMessage('수정할 상품을 찾을 수 없습니다.')); }, [id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const updated = await api<Product>(`/products/${id}`, 'PATCH', { title: form.get('title'), description: form.get('description'), priceKrw: form.get('priceKrw'), category: form.get('category') });
      window.location.assign(`/products/${updated.id}`);
    } catch { setMessage('상품을 수정할 수 없습니다. 예약중 상품은 가격과 핵심 조건을 변경할 수 없습니다.'); }
  }
  if (!product) return <><h1>상품 수정</h1><p role="status">{message}</p></>;
  return <form onSubmit={submit}><label>제목<input name="title" defaultValue={product.title} required maxLength={100} /></label><label>설명<textarea name="description" defaultValue={product.description} required maxLength={2000} /></label><label>가격(원)<input name="priceKrw" defaultValue={product.priceKrw} inputMode="numeric" pattern="[0-9]+" required /></label><label>카테고리<input name="category" defaultValue={product.category} required maxLength={50} /></label><button type="submit">변경 저장</button><p role="status">{message}</p></form>;
}
