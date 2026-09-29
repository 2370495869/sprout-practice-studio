# 题目格式说明

随应用提供的题目库和自定义题包都使用 JSON 对象封装：包含 `schemaVersion`、`title` 和 `questions` 数组。当前格式版本为 1，支持选择题和匹配题，使用 `subject`、`ageGroup` 与 `type` 进行筛选。请在导入前检查答案和教育内容。

## 字段

| 字段                      | 类型       | 含义                                                                |
| ------------------------- | ---------- | ------------------------------------------------------------------- |
| `schemaVersion`           | 数字       | 当前必须为 `1`，用于标识题包格式版本。                              |
| `title`                   | 字符串     | 自定义题包的非空名称。                                              |
| `questions`               | 对象数组   | 题目列表。每道题字段如下。                                          |
| `questions[].id`          | 正安全整数 | 题包内唯一标识。                                                    |
| `questions[].subject`     | 字符串     | `math`、`chinese`、`english` 或 `common`。                          |
| `questions[].ageGroup`    | 字符串     | `3-5`、`6-8` 或 `9-12`。                                            |
| `questions[].type`        | 字符串     | `choice`（选择题）或 `match`（匹配题）。                            |
| `questions[].question`    | 字符串     | 题干。                                                              |
| `questions[].explanation` | 字符串     | 答题后的解释说明。                                                  |
| `questions[].options`     | 字符串数组 | 仅用于选择题；`answer` 是从 0 开始的正确选项下标。                  |
| `questions[].pairs`       | 对象数组   | 仅用于匹配题。每项包含唯一字符串 `id`、左侧 `left` 和右侧 `right`。 |

每道题都应有非空题干和解释。选择题应提供至少两个非空选项，并确保正确选项下标位于 `options` 范围内。匹配题应提供至少一个 pair；每个 pair 的 `id`、`left` 和 `right` 都应为非空文本，同一题内 pair ID 不得重复。

## 选择题示例

```json
{
  "schemaVersion": 1,
  "title": "数学练习",
  "questions": [
    {
      "id": 101,
      "subject": "math",
      "ageGroup": "6-8",
      "type": "choice",
      "question": "3 + 5 = ?",
      "options": ["6", "7", "8", "9"],
      "answer": 2,
      "explanation": "3 加 5 等于 8。"
    }
  ]
}
```

这里的 `answer: 2` 表示第三个选项。顺序变化后必须同步修改 `answer`。

## 匹配题示例

```json
{
  "schemaVersion": 1,
  "title": "英语配对练习",
  "questions": [
    {
      "id": 102,
      "subject": "english",
      "ageGroup": "6-8",
      "type": "match",
      "question": "把英文单词和中文意思配对",
      "pairs": [
        { "id": "cat", "left": "cat", "right": "猫" },
        { "id": "dog", "left": "dog", "right": "狗" }
      ],
      "explanation": "cat 是猫，dog 是狗。"
    }
  ]
}
```

匹配逻辑以 pair ID 作为左右两侧的对应标识。每个 pair 的 `left`/`right` 是呈现给学习者的内容，不要把它们当作键和值的两个自由列表。

## 导入前检查

- JSON 必须能解析为题包对象，`schemaVersion`、`title` 和 `questions` 字段有效。
- `id` 不重复；不同年龄段、学科的值使用约定枚举。
- 选择题答案索引有效；匹配题 pair ID 唯一且左右内容完整。
- 题干、选项和解释没有 HTML、脚本或个人隐私信息。
- 成人已检查事实、答案、措辞、年龄适配和内容来源。

格式验证只能判断数据是否符合结构，不能证明答案正确或符合课程标准。题目 ID 必须是正安全整数，并在同一题包内唯一；导入失败时以当前版本显示的校验反馈为准。
