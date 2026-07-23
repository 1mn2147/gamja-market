'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const apiBase = '/api/v1';

type Product = {
  id: string;
  title: string;
  description: string;
  priceKrw: string;
  category: string;
  status: string;
  isMine: boolean;
  neighborhood: { code: string; name: string };
  images: Array<{ id: string; altText: string; url: string }>;
};

type ProductList = { products: Product[]; nextCursor: string | null };

const MAX_PRODUCT_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

class ApiError extends Error {
  constructor(readonly code: string) { super(code); }
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body) { options.headers = { 'content-type': 'application/json' }; options.body = JSON.stringify(body); }
  const response = await fetch(`${apiBase}${path}`, options);
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T & { code?: string };
  if (!response.ok) throw new ApiError(result.code ?? 'REQUEST_FAILED');
  return result;
}

function price(value: string) { return `${Number(value).toLocaleString('ko-KR')}원`; }


function ProductCard({ product, mine = false, onHidden }: { product: Product; mine?: boolean; onHidden?: () => void }) {
  const [message, setMessage] = useState('');
  async function hide() {
    try {
      await api(`/products/${product.id}/status`, 'PATCH', { status: 'HIDDEN' });
      onHidden?.();
    } catch {
      setMessage('상품을 숨길 수 없습니다.');
    }
  }
  async function remove() {
    if (!window.confirm('이 상품을 삭제할까요? 삭제한 상품은 다시 게시할 수 없습니다.')) return;
    try {
      await api(`/products/${product.id}`, 'DELETE');
      onHidden?.();
    } catch (error) {
      setMessage(error instanceof ApiError && error.code === 'PRODUCT_LOCKED_BY_ACTIVE_TRADE'
        ? '진행 중인 거래가 있어 상품을 삭제할 수 없습니다.'
        : '상품을 삭제할 수 없습니다.');
    }
  }
  return (
    <article className="product-card">
      <Link href={`/products/${product.id}`}><img src={product.images[0]?.url ?? ''} alt={product.images[0]?.altText ?? ''} /><h2 className="product-card-title">{product.title}</h2></Link>
      <p className="product-card-description">{product.description}</p>
      <p>{price(product.priceKrw)} · {product.neighborhood.name}</p><p>{product.category} · {product.status}</p>
      {mine && <div className="product-actions"><Link href={`/products/${product.id}/edit`}>수정</Link><button type="button" onClick={() => void hide()}>숨기기</button><button type="button" onClick={() => void remove()}>삭제</button></div>}
      <p role="status">{message}</p>
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
  const [submitting, setSubmitting] = useState(false);
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'anonymous'>('checking');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Array<{ name: string; size: number; url: string }>>([]);
  useEffect(() => {
    void api<{ user?: unknown }>('/auth/me').then(() => setAuthState('authenticated')).catch(() => setAuthState('anonymous'));
  }, []);
  useEffect(() => {
    const next = selectedFiles.map((file) => ({ name: file.name, size: file.size, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => { for (const preview of next) URL.revokeObjectURL(preview.url); };
  }, [selectedFiles]);
  function selectImages(files: File[]) {
    setSelectedFiles(files);
    if (files.length === 0) return setMessage('상품 사진을 1장 이상 선택해 주세요.');
    if (files.length > MAX_PRODUCT_IMAGES) return setMessage('상품 사진은 최대 5장까지 등록할 수 있습니다.');
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) return setMessage('각 상품 사진은 5MB 이하여야 합니다.');
    // Some embedded browsers omit File.type. The API still verifies the actual
    // PNG/JPEG/WebP magic bytes, so an empty browser MIME is safe to submit.
    if (files.some((file) => file.type && !ACCEPTED_IMAGE_TYPES.has(file.type))) return setMessage('PNG, JPEG 또는 WebP 사진만 등록할 수 있습니다.');
    setMessage(`${files.length}장의 사진을 선택했습니다.`);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = selectedFiles;
    if (files.length === 0) return setMessage('상품 사진을 1장 이상 선택해 주세요.');
    if (files.length > MAX_PRODUCT_IMAGES) return setMessage('상품 사진은 최대 5장까지 등록할 수 있습니다.');
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) return setMessage('각 상품 사진은 5MB 이하여야 합니다.');
    if (files.some((file) => file.type && !ACCEPTED_IMAGE_TYPES.has(file.type))) return setMessage('PNG, JPEG 또는 WebP 사진만 등록할 수 있습니다.');
    setSubmitting(true);
    setMessage('상품을 등록하는 중입니다.');
    try {
      const images = await Promise.all(files.map(async (file) => ({ dataBase64: await toBase64(file), altText: String(form.get(`alt-${file.name}`) || `${file.name} 상품 사진`) })));
      const product = await api<Product>('/products', 'POST', { title: form.get('title'), description: form.get('description'), priceKrw: form.get('priceKrw'), category: form.get('category'), images });
      window.location.assign(`/products/${product.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_IMAGE') setMessage('이미지 파일이 손상되었거나 실제 형식이 PNG, JPEG, WebP가 아닙니다.');
      else if (error instanceof ApiError && ['AUTHENTICATION_REQUIRED', 'UNAUTHORIZED', 'SESSION_REQUIRED'].includes(error.code)) {
        setAuthState('anonymous');
        setMessage('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      }
      else if (error instanceof ApiError && error.code === 'NEIGHBORHOOD_NOT_AVAILABLE') setMessage('등록 가능한 거래 지역이 설정되지 않았습니다.');
      else setMessage('상품을 등록할 수 없습니다. 입력 값을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }
  if (authState === 'checking') return <p role="status">로그인 상태를 확인하는 중입니다.</p>;
  if (authState === 'anonymous') return <section><p role="status">상품을 등록하려면 로그인이 필요합니다.</p><Link href="/login">로그인하기</Link></section>;
  return <form onSubmit={submit}><label>제목<input name="title" required maxLength={100} /></label><label>설명<textarea name="description" required maxLength={2000} /></label><label>가격(원)<input name="priceKrw" inputMode="numeric" pattern="[0-9]+" required /></label><label>카테고리<input name="category" required maxLength={50} /></label><label>사진 (PNG, JPEG, WebP / 장당 5MB 이하, 최대 5장)<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple required onChange={(event) => selectImages(Array.from(event.currentTarget.files ?? []))} /></label>{previews.length > 0 && <div className="image-preview-grid" aria-label="선택한 이미지 미리보기">{previews.map((preview) => <figure key={`${preview.name}-${preview.size}`}><img src={preview.url} alt={`${preview.name} 미리보기`} /><figcaption>{preview.name} · {(preview.size / 1024 / 1024).toFixed(2)}MB</figcaption></figure>)}</div>}<p>상품은 사림동에만 게시되며 상세 주소는 수집·표시하지 않습니다.</p><button type="submit" disabled={submitting}>{submitting ? '등록 중…' : '상품 등록'}</button><p role="status">{message}</p></form>;
}

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product>();
  const [tradeMessage, setTradeMessage] = useState('');
  const [message, setMessage] = useState('상품을 불러오는 중입니다.');
  useEffect(() => { void api<Product>(`/products/${id}`).then((data) => { setProduct(data); setMessage(''); }).catch(() => setMessage('상품을 찾을 수 없습니다.')); }, [id]);
  async function requestTrade() {
    try {
      const trade = await api<{ id: string; chatId: string }>('/trades', 'POST', { productId: id });
      window.location.assign(`/chats/${trade.chatId}`);
    } catch {
      setTradeMessage('거래를 요청할 수 없습니다. 로그인·지역·상품 상태를 확인해 주세요.');
    }
  }
  async function removeProduct() {
    if (!window.confirm('이 상품을 삭제할까요? 삭제한 상품은 다시 게시할 수 없습니다.')) return;
    try {
      await api(`/products/${id}`, 'DELETE');
      window.location.assign('/me/products');
    } catch (error) {
      setTradeMessage(error instanceof ApiError && error.code === 'PRODUCT_LOCKED_BY_ACTIVE_TRADE'
        ? '진행 중인 거래가 있어 상품을 삭제할 수 없습니다.'
        : '상품을 삭제할 수 없습니다.');
    }
  }
  if (!product) return <><h1>상품 상세</h1><p role="status">{message}</p></>;
  return <article className="product-detail"><h1>{product.title}</h1>{product.images.map((image) => <img className="product-image" key={image.id} src={image.url} alt={image.altText} />)}<p>{price(product.priceKrw)}</p><p>거래 지역: {product.neighborhood.name}</p><p className="product-description">{product.description}</p><p>{product.category} · {product.status}</p>{product.isMine ? <div><p>내가 등록한 상품입니다.</p><div className="product-actions"><Link href={`/products/${product.id}/edit`}>상품 수정</Link><button type="button" onClick={() => void removeProduct()}>상품 삭제</button></div></div> : product.status === 'ACTIVE' && <button type="button" onClick={() => void requestTrade()}>판매자에게 거래 요청</button>}<p role="status">{tradeMessage}</p></article>;
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
