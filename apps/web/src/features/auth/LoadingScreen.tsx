// LoadingScreen 只负责启动恢复登录态时的品牌化 loading 状态，避免路由壳混入展示细节。
export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <section className="loading-card">
        <img alt="My-Notion" className="auth-modal-logo light-logo" src="/logo.svg" />
        <img alt="My-Notion" className="auth-modal-logo dark-logo" src="/logo-dark.svg" />
        <p>正在恢复登录态...</p>
      </section>
    </main>
  );
}
