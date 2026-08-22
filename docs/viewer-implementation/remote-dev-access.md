# Content-Site Remote Dev Access

通过 Tailscale 从 tailnet 内远程访问 content-site 的 dev server。

## 配置方法

修改 `apps/content-site/vite.config.ts` 的 `server` 配置：

```ts
server: {
  host: "<tailscale-ip>",  // 替换为当前机器 Tailscale IPv4
  allowedHosts: ["<machine>.tail<xxxxx>.ts.net", "<tailscale-ip>"],
  // ... proxy 配置
}
```

关键参数：
- `host`: 绑定到 Tailscale IP，而不是 `0.0.0.0`（避免暴露到所有网络接口）
- `allowedHosts`: 放行 MagicDNS 域名和 IP，否则 Vite 8 会返回 403

同时移除 `package.json` 的 `dev` 脚本中 `--host localhost` CLI flag，否则会覆盖 vite.config.ts 的 `host`。

## 访问方式

启动后可通过以下方式访问：
- `http://<machine>.tail<xxxxx>.ts.net:4101/`（MagicDNS）
- `http://<tailscale-ip>:4101/`（直接 IP）

## 查看当前 Tailscale IP

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4
```

## 注意

- `localhost:4101` 不再可用（dev server 不再绑定 loopback），在本地也需使用 Tailscale IP 访问
- Tailscale IP 变更时需同步更新 vite.config.ts
- 不使用时建议恢复为 `host: "localhost"` 以保持本地开发体验
