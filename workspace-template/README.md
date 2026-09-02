# 私人运行空间模板

本目录必须复制到一个新的 **Private** GitHub 仓库，不能直接作为公开仓库使用。

在私人仓库的 `Settings → Secrets and variables → Actions` 中设置：

- Secrets：`DEEPSEEK_API_KEY`、`KIMI_API_KEY`；如使用火山方舟，再设置 `ARK_DEEPSEEK_API_KEY`。
- Variables：`OPENLITREVIEW_ENGINE_REPOSITORY=chenGravo/openlitreview-engine`、`OPENLITREVIEW_ENGINE_REF=<经过测试的固定提交 SHA>`；如使用火山方舟，再设置 `ARK_DEEPSEEK_MODEL_ID`。

模型密钥只应存在于私人仓库的 Actions Secrets。不要在任务、Issue、日志或网页环境中填写密钥、联系方式、患者信息或保密资料。

工作流只会在网页或 GitHub Actions 手动启动后运行；没有定时任务。正式使用前请在模型供应商和程序两侧设置预算保护，并把 GitHub Actions 超额付费预算设为 0。
