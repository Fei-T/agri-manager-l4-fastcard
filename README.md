# 农业经理人四级速记

把《农业经理人四级考试实操重点》做成完全离线的安卓学习 App。

## 功能

- 📚 **12 模块 / 48 题**：按原文完整收录，零丢失校验。
- 🃏 **速记卡**：正面题干、背面答案分点，点击翻面。
- 🧠 **每日复习**：1 / 2 / 4 / 7 / 15 / 30 天记忆曲线，支持撤销。
- ✏️ **客观题练习**：选择、判断、填空自动派生，每题可溯源到原文段落。
- 🔀 **实操排序题**：案例措施打乱后重新排序。
- 📝 **模拟考试**：40 题混合卷、90 分钟倒计时、自动评分。
- ⭐ **错题本**：答错自动收录，连对 2 次移出。

## 数据流水线

```bash
npm install
npm run build:data   # docx -> www/data/*.json + data-inline.js
npm run verify       # 12/48 模块题数、派生题数量、srcRef 断言
npm run serve        # 本地预览 http://localhost:5180
```

源文档位于 `source/农业经理人四级考试实操重点(5).docx`。解析器在 `scripts/build-agri-data.js`，带零丢失 selfCheck：376 个段落必须全部进入结构化数据。

## 安卓 APK

本地不需要 JDK / Android SDK。把代码推送到 GitHub `main` 分支后，`.github/workflows/build-apk.yml` 会自动：

1. 安装 Java 21 / Node 24 / Android SDK 组件
2. 生成并校验题库数据
3. `npx cap sync` + `./gradlew assembleDebug`
4. 发布带版本号的 APK 到 Releases

APK 使用 debug 签名，可直接侧载安装。下载后请在手机设置中允许“安装未知来源应用”。

## 目录结构

```
source/            原始 docx
scripts/           解析、派生题、校验脚本
www/               前端 SPA（纯 HTML/CSS/JS）
android/           Capacitor 生成的 Android 工程
.github/workflows/ 云打包工作流
```

## 许可

代码采用 MIT License，详见 LICENSE 与 NOTICE。文档内容仅用于个人学习。
