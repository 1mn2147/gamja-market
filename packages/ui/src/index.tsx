import type { PropsWithChildren } from 'react';

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <a href="/" aria-label="감자마켓 홈" className="site-brand">감자마켓</a>
        <nav aria-label="주요 메뉴">
          <ul className="site-nav">
            <li><a href="/search">상품 찾기</a></li>
            <li><a href="/products/new">상품 등록</a></li>
            <li><a href="/chats">채팅</a></li>
            <li><a href="/trades">거래</a></li>
            <li><a href="/me">내 활동</a></li>
          </ul>
        </nav>
      </header>
      <div id="main-content">{children}</div>
    </div>
  );
}
