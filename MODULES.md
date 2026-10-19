# 系统模块与功能清单

> 用于答辩工作量核对，包含智能合约层、后端服务层、前端展示层、运维脚本层四个层级。所有代码均为本人完成。

---

## 一、整体规模

| 层级 | 文件数 | 代码行数 (LOC) | 说明 |
|---|---:|---:|---|
| 智能合约层 | 7 | **1,429** | Solidity 0.8.20，含访问控制、订单、对账、清算、争议、多签 |
| 部署 / 运维脚本 | 8 | **616** | Node.js，完成编译、部署、初始化数据、链上状态诊断 |
| 前端展示层 | 2 | **2,415** | 单页应用（index.html + app.js），多角色 UI 与合约交互 |
| 后端服务层 | 1 | **139** | Express，承担链下订单池与买家签名验证 |
| **合计** | **18** | **≈ 4,600** | |

智能合约层共 **71 个 public/external 函数**，按合约分布如下：

| 合约 | 行数 | 函数数 | 核心职责 |
|---|---:|---:|---|
| `OrderStorage.sol` | 278 | 13 | 订单存储 + 团购批次管理 |
| `Dispute.sol` | 243 | 12 | 争议状态机 + 仲裁裁决 |
| `Reconciliation.sol` | 239 | 9 | 双方账单提交 + 自动差异比对 |
| `MultiSigWallet.sol` | 221 | 11 | 业务化多签 + 受限确认者 |
| `Settlement.sol` | 221 | 10 | 净额清算 + escrow 资金管理 |
| `ProductRegistry.sol` | 122 | 7 | 商品发布与库存管理 |
| `AccessControl.sol` | 105 | 9 | RBAC + 重入锁 + 紧急暂停 |

---

## 二、智能合约层（核心创新点所在）

### 1. `AccessControl.sol` — 访问控制基础合约

**功能**：

- 四角色权限管理：`ADMIN_ROLE` / `OPERATOR_ROLE` / `ARBITRATOR_ROLE` / `PAUSER_ROLE`
- `onlyRole` 修饰符强制角色校验
- `nonReentrant` 防重入锁（状态检查模式）
- `whenNotPaused` 紧急暂停机制

**核心函数**：`grantRole / revokeRole / hasRole / pause / unpause`

### 2. `ProductRegistry.sol` — 商品注册

**功能**：

- 商家发布商品（需 SELLER_ROLE）
- 商品所有者校验（不能改别人的商品）
- 库存原子扣减（防止超卖）
- 商品上下架

**核心函数**：`createProduct / updateProduct / reduceStock / getActiveProducts`

### 3. `OrderStorage.sol` — 订单与团购批次

**功能**：

- 单笔上链 `placeOrder`（备用入口）
- **团长批量上链 `batchCreateOrders`**（核心创新点：N 笔订单 1 次交易）
- **按商家自动分组 `batchGroupAndFinalize`**（自动拆分多商家批次）
- 团购批次状态管理（finalized）
- 订单状态机：reconciled / disputed
- 多维度查询：按买家、按卖家、按团购批次

**核心函数**：`placeOrder / batchCreateOrders / batchGroupAndFinalize / getGroupOrders / markReconciled / markDisputed`

### 4. `Reconciliation.sol` — 双方账单对账

**功能**：

- 团长发起对账 `startReconciliation`
- **团长账单一步提交 `startReconciliationWithLeaderBill`**（合并交易减少 gas）
- 商家提交账单 `submitSellerBill`
- **合约层身份强校验**：`require(order.seller == msg.sender)`
- **自动逐单差异比对**：金额一致标记 reconciled，不一致标记 mismatched
- 维护匹配数 / 差异数统计

**核心函数**：`startReconciliationWithLeaderBill / submitLeaderBill / submitSellerBill / getBatch / getReconciledOrders / getMismatchedOrders`

### 5. `Settlement.sol` — 净额清算与 Escrow

**功能**：

- 买家预存货款 `depositEscrow`（支持 payable）
- 团长提出清算方案 `proposeSettlement`
- **净额头寸计算 `_calculateNetPositions`**（核心创新点：N 笔交易降至 O(P) 次转账）
- 多签批准后执行 `executeSettlement`
- Escrow 资金追踪：`escrowDeposits[depositor]` + `orderEscrow[orderId]` + `totalEscrow`
- 清算状态机：Proposed / Approved / Executed / Rejected

**核心函数**：`proposeSettlement / approveSettlement / executeSettlement / depositEscrow / getNetPositions / getEscrowInfo`

### 6. `Dispute.sol` — 争议四阶段状态机

**功能**：

- 发起争议 `createDispute`（合约层校验仅订单买卖双方或 admin 可发起）
- 四阶段状态机：`Open → UnderReview → Resolved → Executed`
- 仲裁员主动认领 `assignArbitrator`（避免争议悬而未决）
- 证据上链 `submitEvidence`（任何人可提交，附带提交者地址）
- 责任判定与赔偿金额裁决 `resolveDispute`
- 角色分离：仲裁员裁决，OPERATOR 执行支付
- 自动从 escrow 划转赔偿金

**核心函数**：`createDispute / assignArbitrator / submitEvidence / resolveDispute / executeDispute / getDispute`

### 7. `MultiSigWallet.sol` — 业务化多签钱包

**功能**：

- 标准多签：`submitTransaction / confirmTransaction / revokeConfirmation / executeTransaction`
- **创新点 `submitRestrictedTransaction`**：提交受限交易，写入 `allowedConfirmers` 名单
- 合约层校验 `confirmTransaction` 调用者必须在 `allowedConfirmers` 内
- N-of-M 阈值确认
- 接收 ETH 与发起任意合约调用

**核心函数**：`submitTransaction / submitRestrictedTransaction / confirmTransaction / executeTransaction / revokeConfirmation / getAllowedConfirmers / isAllowedConfirmer`

---

## 三、后端服务层

### `simple-server.js` — Express 服务（139 行）

**功能**：

- 静态资源托管（serving `frontend/`）
- `POST /api/orders` — 接收买家签名订单，**使用 `ethers.verifyMessage` 验签**，恢复地址不匹配则拒绝
- `GET /api/orders` — 列出订单（支持按买家、状态过滤）
- `POST /api/orders/mark-submitted` — 团长上链后回写链上订单 ID
- 订单池持久化到 `data/orders.json`

**安全设计**：

- 链下订单保存前必须通过签名验证
- 团长上链时后端再次校验签名有效性，无效签名阻止上链
- 实现"链下高吞吐 + 链上反伪造"的双层架构

---

## 四、前端展示层

### `frontend/index.html` (963 行) + `frontend/app.js` (1,452 行)

#### 4.1 角色识别与权限控制

- 6 个测试角色：团长 / 仲裁员 / 商家A / 商家B / 买家1 / 买家2 / 买家3
- 自动识别钱包地址 → 角色映射
- **ROLE_TABS** 配置：每个角色看到不同的标签页
- `data-role` 标注：卡片粒度的角色显隐控制

#### 4.2 七个业务标签页

| 标签页 | 商品中心 | 我的订单 | 团购批次 | 多方对账 | 净额清算 | 争议仲裁 | 多签钱包 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 团长 / 仲裁员 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 商家 | ✓ |  |  | ✓ |  | ✓ | ✓ |
| 买家 | ✓ | ✓ |  |  |  | ✓ | ✓ |

#### 4.3 关键交互特性

**商品中心**：

- 商品卡片内嵌下单（数量输入框 + 合计实时预览 + 立即下单按钮）
- 商家可发布新商品（仅 SELLER_ROLE）

**我的订单**：

- 买家待付款金额显示（链上订单总额 - 已 escrow）
- 一键预存货款 `depositEscrow`
- 已上链未对账订单可发起争议（卡片内按钮）

**团购批次**：

- 一键自动汇总（`batchCreateOrders` + `batchGroupAndFinalize`）
- 按商家自动拆分多个独立批次
- 卡片内"一键发起对账"按钮

**多方对账**：

- 商家点"加载并提交我的账单" → 表格在卡片内展开
- 表格自动从链上读取订单数据，商家可逐笔确认或修改金额
- 团长查看 completed 批次直接"提出清算方案"

**净额清算**：

- 清算批次状态可视化（待审批 / 已审批 / 已执行）
- Approved 状态卡片显示"执行净额清算"按钮
- Escrow 合约余额实时展示

**争议仲裁**：

- 买家 / 商家：列出"可发起争议的订单"（自动过滤未上链、已对账、已争议）
- 卡片内输入原因 + 发起争议（一步完成）
- 团长：争议列表卡片内"认领并裁决"展开内联表单（责任方 + 赔偿金额）

**多签钱包**：

- 显示所有多签交易和确认进度
- 受限交易自动过滤：非 `allowedConfirmers` 不显示"确认"按钮
- 一键确认 / 执行

#### 4.4 技术细节

- `ethers.js v5/v6` 双版本兼容自动检测
- 链下签名生成与验证（`signer.signMessage`）
- 实时状态机展示（状态徽章 + 颜色标识）
- BigInt / BigNumber 安全转换工具函数

---

## 五、运维脚本层（616 行）

| 脚本 | 行数 | 功能 |
|---|---:|---|
| `scripts/compile.js` | 77 | solc 直接编译 7 个合约，输出 ABI 与 bytecode 到 `artifacts/` |
| `scripts/deploy.js` | 178 | 部署 7 个合约 + RBAC 角色批量授权 + 自动写入前端合约地址 |
| `scripts/seed-products.js` | 72 | 商家自动发布初始商品（演示数据） |
| `scripts/fund-buyers.js` | 48 | 给买家测试账号自动转 ETH |
| `scripts/fund-deployer.js` | 50 | 给团长账号补充 ETH |
| `scripts/init-geth.js` | 38 | 生成 Geth 私链数据目录 + Clique PoA 创世区块 |
| `scripts/check-state.js` | 70 | 调试工具：查看清算批次和多签交易链上状态 |
| `scripts/approve-settlement.js` | 83 | 调试工具：手动构造多签审批用于异常恢复 |

---

## 六、技术栈与配置

| 层级 | 技术 / 工具 |
|---|---|
| 智能合约 | Solidity 0.8.20，solc 直接编译 |
| 区块链 | Geth (Go-Ethereum)，Clique PoA 共识，Chain ID 887766 |
| 后端 | Node.js + Express |
| 前端 | 原生 HTML/CSS/JS + ethers.js v5/v6 |
| 钱包 | MetaMask |
| 配置 | `genesis.json` 自定义创世区块 |
| 持久化 | `geth-data/` 链上数据 + `data/orders.json` 链下订单 |

---

## 七、核心创新点（已在 README 详述）

1. **链下签名 + 链上批量上链** — gas 优化 N → 1，同时防伪造
2. **业务化多签：受限确认者** — `submitRestrictedTransaction` + `allowedConfirmers`
3. **合约层身份强校验** — `order.seller == msg.sender` 双重保护
4. **净额清算算法** — N 笔交易降至 O(P) 次转账
5. **争议四阶段状态机** — 认领制 + 角色分离 + 发起人限制
6. **双层对账架构** — 链下后端验签 + 链上合约逐单比对

---

## 八、文档清单

| 文件 | 用途 |
|---|---|
| `README.md` | 项目主文档，含 3 张 Mermaid 流程图、创新点详解、答辩说明 |
| `MODULES.md` | 本文档，模块与功能清单 |
| `genesis.json` | Geth 创世区块配置 |
| `package.json` | npm 脚本入口（compile / deploy / seed / start 等） |

---

## 九、可量化的工作量小结

- **7 个智能合约**，共 **71 个函数**，**1,429 行 Solidity** 代码
- **6 个业务角色**的 RBAC 权限矩阵
- **7 个标签页**的前端 UI，按角色动态显隐
- **4 个状态机**（订单 / 对账 / 清算 / 争议）
- **2 笔交易**完成 N 笔订单批量上链 + 多商家分组
- **8 个运维脚本**，覆盖部署、调试、数据初始化全链路
- **链上 + 链下双层验证**架构（合约层 require + 后端 verifyMessage）
- **3 张 Mermaid 流程图**（完整业务流程 / 角色权限矩阵 / 链上链下交互时序）

总代码量 **约 4,600 行**（不含自动生成的 ABI 文件与 node_modules）。
