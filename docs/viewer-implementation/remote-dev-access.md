# Content-Site Remote Dev Access

通过 tailnet 远程访问本机 content-site dev server。tracked 配置必须保持机器无关：
不要把 Tailscale IP 或 MagicDNS 主机名提交进仓库。

## 方式 A（推荐）：`tailscale serve`，不改项目配置

dev server 保持默认绑定 loopback（`host: "127.0.0.1"`），用 Tailscale 把本地端口
发布到 tailnet：

```bash
tailscale serve --bg 4101
```

tailnet 内其他设备访问：

```text
https://<machine>.<tailnet>.ts.net/
```

停止发布：

```bash
tailscale serve reset
```

流量经 tailscaled 反代到 loopback，因此不需要修改 `vite.config.ts`，也不存在
allowedHosts 403 问题。

## 方式 B：`.env.local` 覆盖（确需 Vite 直接绑定 tailnet 接口时）

把机器相关值放进被 git 忽略的 `.env.local`（例如 `VITE_DEV_HOST` /
`VITE_DEV_ALLOWED_HOSTS`），由 `vite.config.ts` 以安全默认值（`127.0.0.1`）兜底
读取；不要把具体 IP / MagicDNS 主机名写进 tracked 文件。

直接绑定时需在 server 配置中放行对应主机名，否则 Vite 8 会返回 403。

## 查看当前 Tailscale IP

```bash
# 任意平台（CLI 在 PATH 中时）
tailscale ip -4

# macOS（App 版未提供 CLI 时）
/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4
```

## 注意

- 不要把机器相关的 Tailscale IP / MagicDNS 主机名提交进 tracked 配置；历史遗留的
  硬编码值应迁移到 `.env.local`。
- 不使用远程访问时无需任何额外配置，dev server 默认仅监听 loopback。
