import Link from 'next/link';
import { AccountPanel } from '../account-forms';

export default function MePage() { return <main><h1>내 활동</h1><AccountPanel /><nav aria-label="내 활동"><Link href="/me/account">계정·인증·세션</Link></nav></main>; }
