---
name: implment-plan
description: Implementation plan for the SvelteKit multi-site rewrite and monorepo deployment.
---

**推荐结论（非 React + 多站点）**

- 主框架建议选 `SvelteKit 2`（四个站点统一技术栈），原因是 SSR/SEO、路由与数据加载、K8s 自托管适配都比较均衡，且比混用框架更利于团队维护。
- 仅把“超重交互媒体能力”做成独立站点并允许更高 CSR 比例（Live2D/Chibi/StoryReader），其余三个站点坚持 SSR-first。
- Monorepo 建议 `pnpm + Turborepo` 起步；你后续若团队扩大再升级到 Nx 的强约束治理。
- 部署建议保持 K8s 主线，同时引入“类 Lambda”能力时优先考虑 Knative（跑在现有 K8s 上），避免再维护第二套云函数平台。
- SSO 建议 `Keycloak` 统一主域会话 + 后端 API 网关/BFF 分层，适配多站点无缝登录。

## Plan: SvelteKit 四站点重写与 Monorepo 部署

基于你确认的方向（Svelte/SvelteKit、4 个独立站点、K8s + 可选类 Lambda、Keycloak SSO），建议采用“统一 SvelteKit 技术栈 + 分站独立部署 + 共享平台包”的方案。原始站点代码在项目根目录上层同级的`sekai-viewer`目录里，原有代码结构显示自然分站边界已较清晰：路由集中在 [src/pages/App.tsx](src/pages/App.tsx)，媒体重交互在 [src/pages/live2d/Live2D.tsx](src/pages/live2d/Live2D.tsx) 与 [src/pages/chibi/Chibi.tsx](src/pages/chibi/Chibi.tsx)，账号能力在 [src/pages/user/Login.tsx](src/pages/user/Login.tsx)，多语言资产在 [public/locales](public/locales)。因此最稳妥路线不是“按页面零散迁移”，而是“按站点域拆分重建”，并通过共享 `domain-sdk`、`auth-client`、`i18n-dicts` 等包保持一致性。

**Steps**

1. 定义四站边界与域名策略：内容站、工具站、媒体实验站、账号/社区站；以 [src/pages/App.tsx](src/pages/App.tsx) 现有路由分组为映射基准。
2. 建立 monorepo 结构（`apps/*` + `packages/*`），统一工程规范与任务编排（`build`/`test`/`lint`/`deploy`），并抽取共享 `symbol`：`createApiClient`、`resolveAssetHost`、`loadLocaleNamespaces`（来源于 [src/utils/apiClient.ts](src/utils/apiClient.ts)、[src/utils/urls.ts](src/utils/urls.ts)、[src/utils/i18n.ts](src/utils/i18n.ts)）。
3. 设计认证架构：Keycloak OIDC + 统一 SSO 会话，站点侧通过 BFF 交换会话并下发最小凭据，替代当前前端直持久 token 方式（参考 [src/stores/user.ts](src/stores/user.ts)）。
4. 设计渲染策略：前三站 SSR-first（可缓存页面尽量预渲染/ISR），媒体站 CSR-first + SSR 壳；将 Live2D 相关能力隔离成独立前端能力域（依据 [src/utils/live2dLoader.ts](src/utils/live2dLoader.ts)）。
5. 部署拓扑：每站独立镜像、通过 Helm chart 参数独立启停、统一 Ingress 网关；对高突发任务引入 Knative Service/Eventing（运行在同一 K8s），避免额外云函数供应商锁定。
6. 可观测与治理：统一日志追踪（trace-id 跨站透传）、统一 Web Vitals 与 SEO 指标看板，按站点做独立 SLO。
7. 交付节奏：先落地内容站（SEO 收益最大）→ 工具站 → 账号站 → 媒体站，确保每阶段可独立上线与回滚。

**Verification**

- SEO：SSR 页面在无 JS 抓取下可获得正文与元信息。
- SSO：跨四站点登录/登出、会话续期、权限边界一致。
- 性能：内容站首屏与 TTFB 改善，媒体站交互帧率与稳定性达标。
- 部署：任一站点可单独发布、回滚，不影响其余站点。

**Decisions**

- 框架：统一 `SvelteKit`，不混用多前端框架。
- 架构：四站点独立部署 + monorepo 共享核心包。
- 运行时：K8s 主线，按需在 K8s 内引入 Knative 作为类 Lambda 能力。
- 鉴权：`Keycloak` 统一 SSO + 后端 API/BFF 支持。
