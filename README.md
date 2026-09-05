# AIR / LAB · 隔空抓取挑战

一个面向 AI 基础课的浏览器互动实验。摄像头识别手部关键点，学生用移动手掌、捏合和松开控制三维机械臂。

## 本地启动

使用 Node.js 22.11 或更新的兼容版本。

```sh
npm ci
npm run dev
```

打开终端显示的 localhost 地址。点击“开启摄像头”并允许权限；不需要麦克风。摄像头图像只进入浏览器内的 MediaPipe 推理流程，不上传、不录制。静态模型和 WASM 均从本站加载。

## 操作

- 手掌左右、上下移动：在桌面范围内移动夹爪。
- 拇指与食指捏合并保持：自动下降抓取，再抬起搬运。
- 在黄色投放区上方松开：自动下降放置，完整落入目标范围加 10 分。
- 鼠标模式：先移动瞄准圆环，再按住左键抓取；保持按住并移动到目标区，松开放置。
- 键盘：点击三维区域后用方向键移动，按住空格抓取，松开放置。
- 手部丢失超过 700ms、窗口失焦或切换标签时，正在进行的挑战会暂停。恢复后点击继续。
- 可自由练习，也可进行 60 秒挑战。刷新页面会清空分数，不保存个人信息。

## 腾讯云部署

仓库：qingci2014/courtyard-studio；部署分支：main。
现有 EdgeOne Pages 关联会在推送后自动构建。

- 安装：npm ci
- 构建：npm run build
- 输出：dist
- 配置：edgeone.json

使用 HTTPS 线上地址。摄像头无法在普通远程 HTTP 页面启动。若内置浏览器不支持权限弹窗，在 Chrome 或 Edge 独立窗口打开同一地址。

```sh
npm test
npm run build
```

## 课堂讲解

感知：MediaPipe 从图像输出 21 个手部关键点。
判断：程序用指尖距离与手掌尺寸的比值判断捏合，使用不同开合阈值和短暂稳定时间减少抖动。
执行：三维机械臂根据坐标运行抓取状态机，计算投放结果。

Codex 用于开发、修改和验证代码；这里的实时视觉识别由预训练模型完成，不依赖大模型 API，也不是自主 Agent。

现场可给 Codex 的增量任务示例：增加连续三次成功投放的连击奖励，并验证重新开始时连击归零。

## 资源与限制

- Three.js：MIT；通过 npm 打包。
- MediaPipe Tasks Vision 0.10.32：Apache-2.0；JS 与 WASM 版本保持一致。
- 手部模型：Google MediaPipe Hand Landmarker float16 v1。
- 模型原始地址：https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- 使用说明：https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js

public/vision 包含完整模型和 SIMD / 非 SIMD WASM 回退。首次加载约 20 MB，模型下载后在本机推理。建议在上课前打开一次网站并检查教室光线、摄像头和硬件加速。当前每秒最多约 15 次识别，三维动画独立刷新。

旧课程页面已由本实验替换，原始版本保留在 Git 提交历史中（替换前提交 b9795ca）。

## Blender 模型

机械臂由 Blender 5.1 建模，网页加载 public/models/nexus-arm.glb（约 3 MB）。

- 可编辑源文件：model-source/nexus-arm.blend
- 独立材质预览：model-source/nexus-preview.png
- 可复现建模脚本：model-source/build_robot.py
- rig 节点：arm_upper、arm_forearm、joint_shoulder、joint_elbow、joint_wrist、arm_tool、grip_left、grip_right。

模型采用有厚度的曲面装甲、倒角、分层轴承、活塞、线缆和分节夹爪；冰蓝灯光不使用全屏泛光。Blender 渲染是独立材质预览，网页使用实时灯光，两者光照效果会有差异。

## 抓取手感优化

- 接近方块时显示轮廓、落点环和“可以抓取”，夹爪自动小范围对准。
- 捏合时锁定高亮目标，下降过程中手部位移不会改变本次抓取目标。
- 手掌使用腕部与中指、无名指、小指根部定位，减少食指捏合带来的偏移。
- 小幅抖动平滑处理；闭合确认约 80ms，张开确认约 200ms，降低误掉落。
- 接近投放区后提示松开，并辅助对准中心；远离目标区释放仍正常放回桌面。
- 自动测试覆盖 16 个场景；实际摄像头手感需结合设备和光线试用。
