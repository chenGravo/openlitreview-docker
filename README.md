# 文澜综述（OpenLitReview）

文澜综述是一个按需启动的中文学术文献综述入口。网页只负责接收任务、启动使用者自己的私人 GitHub Actions 工作流并显示结果；文献检索、证据提取和写作在云端临时运行，任务结束后自动停止。

## 一键 Docker 部署

需要 Docker Compose，以及一个由你控制的私人 OpenLitReview 工作区仓库。

```bash
git clone https://github.com/chenGravo/openlitreview-docker.git
cd openlitreview-docker
cp .env.example .env
# 编辑 .env，填入你自己的 GitHub 工作流信息
docker compose up -d --build
```

然后打开 <http://127.0.0.1:3000>。默认只监听本机，避免误把私人任务入口暴露到互联网。

`.env` 至少需要：

- `GITHUB_WORKFLOW_TOKEN`：只授权目标私人仓库所需的最小权限；
- `GITHUB_WORKFLOW_OWNER`：你的 GitHub 用户名或组织名；
- `GITHUB_WORKFLOW_REPOSITORY`：私人运行空间仓库名；
- `GITHUB_WORKFLOW_FILE`：默认 `run-review.yml`；
- `GITHUB_WORKFLOW_REF`：默认 `main`。

如需通过公网域名访问，请使用 HTTPS，并同时填写 `PORTAL_BASIC_AUTH_USER` 和足够长的 `PORTAL_BASIC_AUTH_PASSWORD`；还应在云平台防火墙或反向代理处限制访问。不要把 `.env` 上传到 GitHub。

## 云端工作空间

本仓库的 `workspace-template/` 是可复制的私人工作空间模板。把其中内容放进一个新的 **Private** GitHub 仓库，再在该仓库中设置模型 API 密钥和经过测试的引擎版本。公开检索引擎位于 [openlitreview-engine](https://github.com/chenGravo/openlitreview-engine)。

每位部署者必须使用自己的 GitHub 账号、私人工作空间、模型密钥和预算。这个公开项目不会提供、收集或转发 chenGravo 的令牌、联系方式、历史任务或模型额度。

## 安全与隐私

- 不向文献网站发送姓名、邮箱、电话号码、GitHub 用户名或仓库名；只发送学术检索词、DOI/文献网址及网络请求所必需的信息。
- 页面会拦截明显的邮箱、手机号和身份证号，但使用者仍不得提交患者信息、未成年人敏感信息、保密资料或无权处理的全文。
- 模型密钥只保存在使用者自己的私人 GitHub 仓库；网页容器只保存 GitHub 工作流令牌。
- 正式使用前请同时设置模型侧和程序侧预算上限。

## 验证

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
docker compose config
```

项目采用 AGPL-3.0-or-later 许可证。学术输出仍需由使用者核验引文、证据和适用的 AI 披露规则。
