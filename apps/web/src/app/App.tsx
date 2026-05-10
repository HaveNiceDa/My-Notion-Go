import { apiClient } from "@my-notion-go/api-client";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">My-Notion Go Edition</p>
        <h1>React + Go 独立全栈工程</h1>
        <p>当前 API 地址：{apiClient.baseUrl}</p>
      </section>
    </main>
  );
}
