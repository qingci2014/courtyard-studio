# 源码与许可

包含 DWG 组件的 floor 工作台整体按 GNU GPL v3 发布，全文见 LICENSE。原 floorplan-3d、Three.js 等 MIT 声明继续保留；此许可范围是 floor 工作台，不包含仓库中的其他独立应用。

工作台源码：https://github.com/qingci2014/courtyard-studio/tree/main/floor 。发布时，/floor/source.html 提供该次构建 Git 提交对应的源码 ZIP、许可和以下 DWG 对应源码链接。源码中的 package-lock.json 固定 npm 依赖；Node.js 22 环境进入 floor 后执行 npm ci，再执行 npm run build -- --base=/floor/。dist 是静态页面，无需额外后端。

DWG 组件 @mlightcad/libredwg-web 0.7.14 的完整源码（包括 C/C++、Embind、TypeScript 和构建脚本）固定在提交 1dd682f46339f37b67c5ff1085d10d04a8c16d7e：

- 浏览：https://github.com/mlightcad/libredwg-web/tree/1dd682f46339f37b67c5ff1085d10d04a8c16d7e
- 下载：https://github.com/mlightcad/libredwg-web/archive/1dd682f46339f37b67c5ff1085d10d04a8c16d7e.zip
- 重编译说明：该提交的 bindings/javascript/README.md，命令在 bindings/javascript/package.json。
- jsmn 子模块：https://github.com/zserge/jsmn/tree/85695f3d5903b1cd5b4030efe50db3b4f5f3c928 。使用 Git 下载时执行 git submodule update --init；ZIP 下载不包含子模块，需单独下载此版本放入 jsmn。

重编译先安装 Emscripten、Autotools、pnpm，在仓库根目录运行 ./autogen.sh，然后进入 bindings/javascript，依次运行 pnpm install、pnpm build:prepare、pnpm build:obj、pnpm build:wasm、pnpm copy、pnpm build。工作台未修改此组件。npm 包中使用的 WASM 与上述固定提交的 bindings/javascript/wasm/libredwg-web.wasm 完全一致：大小 9496803 字节，Git blob SHA-1 d6550b006db6349934e0821307d0853dab424e25；准备发布资源时自动核验，避免源码链接与组件版本不符。

发布维护时需保持上述对应源码可免费下载；更换 DWG 组件必须同步更新固定提交、校验值和源码链接。第三方许可随构建输出到 /floor/third-party-licenses.txt。
