# 简历与面试准备

以下简历要点只描述仓库已有或明确配置的工作，不包含未经测量的性能、用户量、覆盖率或成效数字。投递前应根据实际代码与工作流结果调整动词和范围。

## Resume bullets

- Built Sprout Practice Studio, a static parent- and teacher-assisted practice app for children ages 3–12, covering math, Chinese, English, and general knowledge.
- Implemented reusable question-driven activities for multiple-choice practice, matching, timed challenges, and keyword search.
- Separated question-bank rules from browser UI and kept scores and custom question packs in browser-local storage without accounts or a backend.
- Added Node.js 24 GitHub Actions workflows for linting, formatting, tests, builds, GitHub Pages deployment, and tagged static releases.

Do not add claims about user adoption, educational outcomes, accessibility conformance, test coverage, or successful deployments without measured evidence.

## 面试问题与诚实回答要点

### 1. 这个项目解决什么问题？

面向家长或老师陪伴儿童完成短时、按年龄段和学科选择的练习。它是轻量练习工具，不是学校管理系统或经过认证的课程平台。

### 2. 为什么选择静态站点，没有后端？

当前使用场景不需要账号、云端同步或多人管理。静态部署减少运维组件，也避免集中收集孩子练习数据；代价是数据只在当前浏览器，换设备不自动同步。

### 3. 为什么采用 Vite 和原生 ES modules？

两个 HTML 入口共享题库和状态逻辑，需要显式模块边界与可重复构建。Vite 提供开发和构建支持，原生模块保持 UI 依赖较轻；它不承担后端职责。

### 4. 题库模型如何支持不同活动？

题目通过年龄段、学科和题型筛选。选择题使用 `options` 与零起始答案索引；匹配题使用带稳定 ID 的 `pairs`，每项保存左右两侧内容。渲染组件读取领域模型，不应自行改变题目语义。

### 5. 如何验证导入的自定义题包？

检查题包 envelope 的 schema 版本、名称和题目数组，以及题型字段、ID、答案索引和匹配 pair；校验通过后才替换当前本地题包。格式验证无法取代成人对事实、解释和适龄性的审核。

### 6. 为什么把分数和自定义题包放在本地？

练习场景不要求跨设备账户；浏览器本地存储可以持久化小体量状态。需要说明容量、站点来源隔离和清理后丢失的限制，并让用户导出题包备份。

### 7. 项目如何处理儿童隐私？

当前设计不要求姓名或联系方式，也没有账户、云端档案或行为分析。仍需避免把可识别信息写进公开题包；浏览器本地存储并不等于设备加密或家长控制。

### 8. Node 内置测试覆盖什么，没覆盖什么？

适合覆盖纯题库规则、输入校验、筛选和状态序列化。它不能替代真实浏览器对布局、配对操作、触摸、键盘和屏幕阅读器体验的验证。

### 9. GitHub Pages 子路径为什么需要单独处理？

项目站点位于 `/<repository>/`，静态资源若以 `/assets/...` 加载就会指向域名根。构建时设置 Vite `base` 为仓库路径；静态 ZIP 使用相对路径构建，部署后仍需实际检查。

### 10. 定时挑战如何避免计时器残留？

切换活动或结束挑战时应清理 interval，并把活动状态与当前会话一同重置。纯函数测试可以检查状态转换；计时器和页面切换仍应在浏览器验证。

### 11. 这些题目是否符合课程标准？

不能这样声称。题库中的 64 道题是演示样例，尚未经过课程专家或学校审核；格式和答案检查不等同于课程审校。

### 12. 项目如何防止伪造的质量指标？

报告实际 Actions 运行、测试结果和用户研究数据。没有实际报告就不声称测试通过、覆盖率数值或教育效果；CI 徽章只反映仓库运行状态。

### 13. 题库新增一种题型需要改哪些部分？

扩充 schema 和验证规则，增加题型的 UI 与状态处理，更新内容指南和 Node 测试，并人工验证键盘、触屏与窄屏操作。只改数据不足以实现新交互。

### 14. 下一步最值得做什么？

先完成本地题包导入错误恢复和状态一致性验证，再做浏览器级触摸/可访问性检查，并建立成人内容审校流程。只有在需求明确且有隐私设计后才考虑云同步或账号。
