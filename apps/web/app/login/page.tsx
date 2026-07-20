import Link from 'next/link';
import { LoginForm } from '../account-forms';

export default function LoginPage() {
  return <main><h1>로그인</h1><LoginForm /><p><Link href="/password/reset">비밀번호 재설정</Link> · <Link href="/signup">회원가입</Link></p></main>;
}
