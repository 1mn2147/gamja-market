'use client';

import { FormEvent, useState } from 'react';
import { ProductFeed } from '../product-client';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(`query=${encodeURIComponent(query)}`); }
  return <main><h1>상품 검색</h1><form onSubmit={submit}><label>검색어<input value={query} onChange={(event) => setQuery(event.currentTarget.value)} maxLength={100} /></label><button type="submit">검색</button></form><ProductFeed query={submitted} /></main>;
}
