# 开发指南

## 环境要求

- Node.js 22.12.0 或更高版本；CI 固定使用 Node.js 24
- npm（使用仓库中的 `package-lock.json` 安装可重复依赖）
- Git

## 获取代码并启动

```sh
git clone https://github.com/2370495869/sprout-practice-studio.git
cd sprout-practice-studio
npm ci
npm run dev
```

Vite 会打印开发服务器地址。首页选择年龄段和学科后进入练习页。浏览器存储按站点来源隔离；本地开发数据不会自动出现在 Pages 域名下。

## 常用命令

| 命令                    | 用途                           |
| ----------------------- | ------------------------------ |
| `npm run dev`           | 启动 Vite 开发服务器           |
| `npm run lint`          | 运行 ESLint                    |
| `npm run format:check`  | 检查 Prettier 格式，不改写文件 |
| `npm test`              | 使用 Node 内置测试运行器       |
| `npm run test:coverage` | 为确定性领域模块生成覆盖率报告 |
| `npm run build`         | 生成 Vite 静态构建             |
| `npm run preview`       | 在本地预览构建产物             |

质量检查和 CI 使用的固定步骤为：

```sh
npm ci
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
```

CI 运行在 Node.js 24。`npm run test:coverage` 只对确定性领域模块报告覆盖率，不代表浏览器 UI 的覆盖率；当前没有将报告数值描述为质量成效。请以 `package.json` 中现有脚本和 GitHub Actions 运行记录为准；尚未执行的命令不能作为已通过的检查报告。

## 修改题目

题目数据应遵循[题目格式说明](question-format.md)。提交题目改动时：

1. 检查题目年龄段、学科和题型字段。
2. 手工核对答案及解释，确保题干没有歧义。
3. 对配对题确认每个题目项都有一个且只有一个正确匹配。
4. 不添加儿童个人信息、真实姓名、联系方式或学校信息。
5. 说明内容来源与复核边界；格式校验不能替代课程审校。

自定义题包只保存在浏览器。问题排查时可以先导出 JSON 备份；不要把包含个人信息的题包附到公开 Issue。

## 提交前的手动检查

自动化检查不覆盖所有浏览器交互。涉及 UI 的改动还应人工检查：

- 首页年龄和学科选择，以及返回操作。
- 选择题反馈、匹配交互、限时挑战计时器和搜索结果。
- 键盘操作、窄屏布局、触摸设备上的替代交互。
- 自定义题包导入错误时是否保留旧数据，以及导出后能否重新导入。
- 构建后从根路径和 `/sprout-practice-studio/` 子路径加载静态资源。

这里只列检查步骤，不代表这些浏览器检查已经在所有环境执行。

## Pull request 指南

- 保持单个 PR 聚焦，并描述用户可观察到的行为变化。
- 题库 schema、导入导出或存储格式变化时更新相关文档和测试。
- 报告实际执行过的检查及结果；未运行的检查标为未运行。
- UI 截图只有在真实页面截图完成后，才保存到 `docs/screenshots/home.png` 并在 README 启用图片引用。

尚无已验证的线上演示地址；Pages 部署状态以工作流运行记录为准。静态构建当前不含离线缓存。
