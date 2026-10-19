const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { ethers } = require('ethers');
const app = express();
const port = 3000;

// 解析 JSON 请求体
app.use(express.json());

// ==================== 链下订单存储 ====================
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const ADDRESSES_FILE = path.join(__dirname, 'data', 'addresses.json');

// 确保 data 目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// 实时监听 GroupFinalized 事件，立即发起对账并提交团长账单（避免等待定时器）
function startRealtimeReconWatcher() {
    if (reconWatcherStarted) return;
    reconWatcherStarted = true;
    try {
        const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(LEADER_PRIVATE_KEY, provider);
        const orderStorageContract = new ethers.Contract(addrs.orderStorage, ORDER_STORAGE_ABI_FOR_SERVER, provider);
        const reconContract = new ethers.Contract(addrs.reconciliation, RECONCILIATION_ABI, wallet);

        orderStorageContract.on('GroupFinalized', async (groupIdBN) => {
            const g = Number(groupIdBN);
            if (pendingReconGroups.has(g)) return;
            pendingReconGroups.add(g);
            try {
                const [, leader, orderIds, , , finalized] = await orderStorageContract.getGroup(g);
                if (!finalized || orderIds.length === 0) { pendingReconGroups.delete(g); return; }
                if (leader.toLowerCase() !== wallet.address.toLowerCase()) { pendingReconGroups.delete(g); return; }

                // 避免重复：若已存在该组的对账批次则跳过
                const total = Number(await reconContract.nextBatchId());
                for (let i = 0; i < total; i++) {
                    const rb = await reconContract.getBatch(i);
                    if (Number(rb.groupId) === g) { pendingReconGroups.delete(g); return; }
                }

                const groupOrders = await orderStorageContract.getGroupOrders(g);
                const billOrderIds = groupOrders.map(o => Number(o.orderId));
                const amounts = groupOrders.map(o => o.amount);
                if (billOrderIds.length === 0) { pendingReconGroups.delete(g); return; }

                console.log(`⚡ [实时对账] 监听到 GroupFinalized 事件，立即为批次 #${g} 发起对账...`);
                const tx = await reconContract.startReconciliationWithLeaderBill(g, billOrderIds, amounts, { gasLimit: 3_000_000 });
                await tx.wait();
                const reconBatchId = Number(await reconContract.nextBatchId()) - 1;
                console.log(`✅ [实时对账] 已创建对账批次 #${reconBatchId}（组 #${g}），等待商家提交。`);
            } catch (err) {
                console.warn(`[实时对账] 处理失败：${err.message}`);
            } finally {
                setTimeout(() => pendingReconGroups.delete(g), 1500);
            }
        });

        console.log('🔔 已开启 GroupFinalized 实时对账监听');
    } catch (e) {
        console.warn(`⚠️ 启动实时对账监听失败：${e.message}`);
    }
}

// ==================== 链上只读连接（用于库存/价格校验） ====================
const RPC_URL = 'http://localhost:8545';
const PRODUCT_REGISTRY_ABI = [
    "function getProduct(uint256) view returns (tuple(uint256 productId,string name,uint256 price,address seller,uint256 stock,bool active,uint256 createdAt))"
];
const SETTLEMENT_ESCROW_ABI = [
    "function escrowDeposits(address) view returns (uint256)"
];
let productRegistry = null;
function getProductRegistry() {
    if (productRegistry) return productRegistry;
    if (!fs.existsSync(ADDRESSES_FILE)) return null;
    try {
        const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        if (!addrs.productRegistry) return null;
        // 如果端口没在线，就先静默返回 null，不拉起 provider
        const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
        productRegistry = new ethers.Contract(addrs.productRegistry, PRODUCT_REGISTRY_ABI, provider);
        return productRegistry;
    } catch (e) {
        return null;
    }
}

// 同一商品，已下未结清的链下订单累计数量（pending + submitted + grouped 都占库存）
function getOffChainReservedQty(orders, productId) {
    return orders
        .filter(o => Number(o.productId) === Number(productId)
            && (o.status === 'pending' || o.status === 'submitted' || o.status === 'grouped'))
        .reduce((sum, o) => sum + Number(o.quantity || 0), 0);
}

function loadOrders() {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    
    // 动态向下兼容：自动根据 verifyOrderSignature 矫正 signatureValid 状态
    let changed = false;
    orders.forEach(o => {
        const valid = verifyOrderSignature(o);
        if (o.signatureValid !== valid) {
            o.signatureValid = valid;
            changed = true;
        }
    });
    if (changed) {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    }
    return orders;
}

function saveOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function getReservedPrepaidAmount(orders, buyerAddress) {
    return orders
        .filter(o => o.buyerAddress && o.buyerAddress.toLowerCase() === buyerAddress.toLowerCase())
        .filter(o => o.status === 'pending' || o.status === 'submitted' || o.status === 'grouped')
        .reduce((sum, o) => sum + BigInt(o.totalAmount || '0'), 0n);
}

async function getBuyerPrepaidBalance(addrs, buyerAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    const settlement = new ethers.Contract(addrs.settlement, SETTLEMENT_ESCROW_ABI, provider);
    return BigInt(await settlement.escrowDeposits(buyerAddress));
}

function buildOrderMessage(order) {
    return [
        'CommunityGroupBuyingOrder',
        `buyerAddress=${order.buyerAddress.toLowerCase()}`,
        `productId=${Number(order.productId)}`,
        `productName=${order.productName || ''}`,
        `sellerAddress=${(order.sellerAddress || '').toLowerCase()}`,
        `quantity=${Number(order.quantity)}`,
        `unitPrice=${order.unitPrice || '0'}`,
        `totalAmount=${order.totalAmount}`
    ].join('\n');
}

function verifyOrderSignature(order) {
    if (!order.signature || !order.orderMessage) return false;
    
    // 如果是批量打包下单，由于签名是针对整个 bulkMessage 的，这里我们进行 bulkMessage 验证
    if (order.isBulk && order.bulkMessage) {
        try {
            const recovered = ethers.verifyMessage(order.bulkMessage, order.signature);
            return recovered.toLowerCase() === order.buyerAddress.toLowerCase();
        } catch (e) {
            return false;
        }
    }

    const expectedMessage = buildOrderMessage(order);
    if (order.orderMessage !== expectedMessage) return false;
    const recovered = ethers.verifyMessage(order.orderMessage, order.signature);
    return recovered.toLowerCase() === order.buyerAddress.toLowerCase();
}

// 验证批量打包签名的函数
function verifyBulkOrderSignature(buyerAddress, items, bulkMessage, signature) {
    if (!signature || !bulkMessage) return false;
    
    // 生成预期的批量合并 Message 文本
    const lines = [
        'CommunityGroupBuyingBulkOrders',
        `buyerAddress=${buyerAddress.toLowerCase()}`,
        `totalItems=${items.length}`
    ];
    items.forEach((it, i) => {
        lines.push(`Item#${i}: productId=${it.productId}, quantity=${it.quantity}, totalAmount=${it.totalAmount}`);
    });
    const expectedMessage = lines.join('\n');
    
    if (bulkMessage !== expectedMessage) return false;
    const recovered = ethers.verifyMessage(bulkMessage, signature);
    return recovered.toLowerCase() === buyerAddress.toLowerCase();
}

// 批量下单接口：聚合一键签名下单（即使有100个商品，也只需在 MetaMask 签一次名！）
app.post('/api/orders/bulk', async (req, res) => {
    const { buyerAddress, items, bulkMessage, signature } = req.body;

    if (!buyerAddress || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '无效的批量下单参数' });
    }

    const registry = getProductRegistry();
    if (!registry) {
        return res.status(500).json({ error: '后端未连接到链上 ProductRegistry，请先编译部署' });
    }

    // ---- 1. 对批量里的每一项进行完整库存、上架、金额校验 ----
    const validatedItems = [];
    const orders = loadOrders();

    for (const it of items) {
        const qty = Number(it.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
            return res.status(400).json({ error: `商品 ID #${it.productId} 的数量必须是正整数` });
        }

        let product;
        try {
            product = await registry.getProduct(Number(it.productId));
        } catch (e) {
            return res.status(400).json({ error: `查询商品 #${it.productId} 失败：` + e.message });
        }

        if (!product.active) {
            return res.status(400).json({ error: `商品 ${product.name} 已下架` });
        }

        // 金额匹配性校验
        const expectedTotal = (BigInt(product.price) * BigInt(qty)).toString();
        if (it.totalAmount !== expectedTotal) {
            return res.status(400).json({ error: `${product.name} 金额校验失败，应为 ${expectedTotal} wei` });
        }

        // 库存占用检测
        const onChainStock = Number(product.stock);
        const reserved = getOffChainReservedQty(orders, it.productId);
        const available = onChainStock - reserved;
        if (qty > available) {
            return res.status(400).json({
                error: `库存不足：${product.name} 当前可购 ${available} 件（链上 ${onChainStock}，已被占用 ${reserved}）`
            });
        }

        validatedItems.push({
            productId: Number(it.productId),
            productName: product.name,
            sellerAddress: product.seller.toLowerCase(),
            quantity: qty,
            unitPrice: product.price.toString(),
            totalAmount: expectedTotal
        });
    }

    // ---- 2. 验证唯一的聚合签名 ----
    if (!verifyBulkOrderSignature(buyerAddress, items, bulkMessage, signature)) {
        return res.status(400).json({ error: '批量合并订单签名验证无效，拒绝入库' });
    }

    // ---- 3. 预存款额度校验：只能购买低于可用预存余额的商品 ----
    const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
    const prepaid = await getBuyerPrepaidBalance(addrs, buyerAddress);
    const reserved = getReservedPrepaidAmount(orders, buyerAddress);
    const batchTotal = validatedItems.reduce((sum, it) => sum + BigInt(it.totalAmount), 0n);
    const availablePrepaid = prepaid > reserved ? prepaid - reserved : 0n;
    if (batchTotal > availablePrepaid) {
        return res.status(400).json({
            error: `预存余额不足：本次需 ${ethers.formatEther(batchTotal)} ETH，可用预存 ${ethers.formatEther(availablePrepaid)} ETH`
        });
    }

    // ---- 4. 校验通过，原子性批量建档入库 ----
    const now = Date.now();
    const createdOrders = [];
    validatedItems.forEach(it => {
        const newOrder = {
            id: orders.length,
            buyerAddress,
            productId: it.productId,
            productName: it.productName,
            sellerAddress: it.sellerAddress,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalAmount: it.totalAmount,
            status: 'pending',
            timestamp: now,
            onChainOrderId: 0,
            isBulk: true,         // 标注此订单是一键打包下单
            bulkMessage,         // 附加当时打包的批量 Message 文本
            signatureValid: true, // 设置有效标志，让前端能够完美高亮
            orderMessage: buildOrderMessage({
                buyerAddress,
                productId: it.productId,
                productName: it.productName,
                sellerAddress: it.sellerAddress,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalAmount: it.totalAmount
            }),
            signature // 复用这个批量签名作为其授权依据
        };
        orders.push(newOrder);
        createdOrders.push(newOrder);
    });

    saveOrders(orders);
    console.log(`🛒 [批量下单] 成功！买家 ${buyerAddress} 通过一键合并签名创建了 ${createdOrders.length} 笔订单！`);
    res.json({ success: true, count: createdOrders.length });
});

// 买家下单（链下，无需 MetaMask）
app.post('/api/orders', async (req, res) => {
    const { buyerAddress, productId, productName, sellerAddress, quantity, unitPrice, totalAmount, orderMessage, signature } = req.body;

    // ---- 1. 基本字段校验 ----
    if (!buyerAddress || productId === undefined || quantity === undefined || !totalAmount) {
        return res.status(400).json({ error: '缺少必要字段' });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: '数量必须是正整数' });
    }
    if (qty > 10000) {
        return res.status(400).json({ error: '单次下单数量过大（上限 10000）' });
    }

    // ---- 2. 链上权威校验：商品上架 + 价格 + 卖家 + 库存 ----
    const registry = getProductRegistry();
    if (!registry) {
        return res.status(500).json({ error: '后端未连接到链上 ProductRegistry，请先 npm run deploy' });
    }
    let product;
    try {
        product = await registry.getProduct(Number(productId));
    } catch (e) {
        return res.status(400).json({ error: '查询商品失败：' + e.message });
    }
    if (!product.active) {
        return res.status(400).json({ error: '该商品已下架' });
    }
    if (sellerAddress && sellerAddress.toLowerCase() !== product.seller.toLowerCase()) {
        return res.status(400).json({ error: '卖家地址与链上不一致' });
    }
    const expectedTotal = (BigInt(product.price) * BigInt(qty)).toString();
    if (totalAmount !== expectedTotal) {
        return res.status(400).json({ error: `订单金额不匹配，应为 ${expectedTotal} wei` });
    }

    // ---- 3. 库存校验：链上剩余 - 已占用（链下未上链/已上链未结清） >= 本次数量 ----
    const onChainStock = Number(product.stock);
    const orders = loadOrders();
    const reserved = getOffChainReservedQty(orders, productId);
    const available = onChainStock - reserved;
    if (qty > available) {
        return res.status(400).json({
            error: `库存不足：${product.name} 当前可购 ${available} 件（链上库存 ${onChainStock}，已被占用 ${reserved}）`
        });
    }

    // ---- 4. 签名校验 ----
    const payload = { buyerAddress, productId, productName, sellerAddress, quantity: qty, unitPrice, totalAmount, orderMessage, signature };
    if (!verifyOrderSignature(payload)) {
        return res.status(400).json({ error: '订单签名无效，拒绝保存' });
    }

    // ---- 5. 预存款额度校验：只能购买低于可用预存余额的商品 ----
    const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
    const prepaid = await getBuyerPrepaidBalance(addrs, buyerAddress);
    const reservedPrepaid = getReservedPrepaidAmount(orders, buyerAddress);
    const availablePrepaid = prepaid > reservedPrepaid ? prepaid - reservedPrepaid : 0n;
    if (BigInt(totalAmount) > availablePrepaid) {
        return res.status(400).json({
            error: `预存余额不足：本次需 ${ethers.formatEther(totalAmount)} ETH，可用预存 ${ethers.formatEther(availablePrepaid)} ETH`
        });
    }

    // ---- 6. 保存 ----
    const order = {
        id: orders.length,
        buyerAddress,
        productId: Number(productId),
        productName: productName || product.name,
        sellerAddress: product.seller,
        quantity: qty,
        unitPrice: product.price.toString(),
        totalAmount,
        orderMessage,
        signature,
        signatureValid: true,
        timestamp: Date.now(),
        status: 'pending',
        onChainOrderId: null,
    };
    orders.push(order);
    saveOrders(orders);
    res.json({ success: true, order });
});

// 获取所有链下订单
app.get('/api/orders', (req, res) => {
    const orders = loadOrders();
    const { status, buyer } = req.query;
    let filtered = orders;
    if (status) filtered = filtered.filter(o => o.status === status);
    if (buyer) filtered = filtered.filter(o => o.buyerAddress.toLowerCase() === buyer.toLowerCase());
    res.json(filtered);
});

// 团长批量提交后，更新订单状态（拒绝已取消订单）
app.post('/api/orders/mark-submitted', (req, res) => {
    const { orderIds, onChainStartId } = req.body;
    const orders = loadOrders();
    const invalid = orderIds.filter(id =>
        !orders[id] || orders[id].status !== 'pending' || !verifyOrderSignature(orders[id])
    );
    if (invalid.length > 0) {
        return res.status(400).json({ error: `存在已取消或签名无效订单：${invalid.join(', ')}` });
    }
    orderIds.forEach((id, index) => {
        if (orders[id]) {
            orders[id].status = 'submitted';
            orders[id].onChainOrderId = onChainStartId + index;
        }
    });
    saveOrders(orders);
    res.json({ success: true });
});

// ==================== 汇总策略配置 + 就绪检测 ====================
const LEADER_CONFIG_FILE = path.join(__dirname, 'data', 'leader-config.json');
const DEFAULT_LEADER_CONFIG = {
    cutoffHours: 24,        // 兜底截单：最早 pending 订单超过 N 小时则该商家所有订单 ready
    thresholdCount: 20,     // 满量提前：单商家 pending 订单数 ≥ N 则 ready
    thresholdAmountEth: 1   // 满量提前：单商家 pending 总额 ≥ N ETH 则 ready
};
function loadLeaderConfig() {
    if (!fs.existsSync(LEADER_CONFIG_FILE)) return { ...DEFAULT_LEADER_CONFIG };
    try {
        const c = JSON.parse(fs.readFileSync(LEADER_CONFIG_FILE, 'utf8'));
        return { ...DEFAULT_LEADER_CONFIG, ...c };
    } catch { return { ...DEFAULT_LEADER_CONFIG }; }
}
function saveLeaderConfig(cfg) {
    fs.writeFileSync(LEADER_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

app.get('/api/leader-config', (req, res) => {
    res.json(loadLeaderConfig());
});

app.post('/api/leader-config', (req, res) => {
    const { cutoffHours, thresholdCount, thresholdAmountEth } = req.body || {};
    const cfg = loadLeaderConfig();
    if (cutoffHours !== undefined) {
        const v = Number(cutoffHours);
        if (!isFinite(v) || v <= 0 || v > 720) return res.status(400).json({ error: 'cutoffHours 必须 0~720' });
        cfg.cutoffHours = v;
    }
    if (thresholdCount !== undefined) {
        const v = parseInt(thresholdCount, 10);
        if (!Number.isInteger(v) || v < 1 || v > 10000) return res.status(400).json({ error: 'thresholdCount 必须 1~10000' });
        cfg.thresholdCount = v;
    }
    if (thresholdAmountEth !== undefined) {
        const v = Number(thresholdAmountEth);
        if (!isFinite(v) || v <= 0) return res.status(400).json({ error: 'thresholdAmountEth 必须 > 0' });
        cfg.thresholdAmountEth = v;
    }
    saveLeaderConfig(cfg);
    res.json({ success: true, config: cfg });
});

// 团长查看每个商家的"汇总就绪状态"
app.get('/api/batch-readiness', (req, res) => {
    const cfg = loadLeaderConfig();
    const orders = loadOrders();
    const pending = orders.filter(o => o.status === 'pending');
    const now = Date.now();
    const cutoffMs = cfg.cutoffHours * 3600 * 1000;
    const thresholdAmountWei = BigInt(Math.floor(cfg.thresholdAmountEth * 1e18));

    // 按商家分组
    const grouped = {};
    for (const o of pending) {
        const seller = (o.sellerAddress || '').toLowerCase();
        if (!grouped[seller]) grouped[seller] = { seller, orders: [] };
        grouped[seller].orders.push(o);
    }

    const groups = Object.values(grouped).map(g => {
        const count = g.orders.length;
        const oldestTs = Math.min(...g.orders.map(o => o.timestamp || now));
        const ageMs = now - oldestTs;
        const totalWei = g.orders.reduce((sum, o) => sum + BigInt(o.totalAmount || '0'), 0n);

        const reasons = [];
        if (ageMs >= cutoffMs) reasons.push(`已等待 ${(ageMs / 3600000).toFixed(1)}h ≥ 截单 ${cfg.cutoffHours}h`);
        if (count >= cfg.thresholdCount) reasons.push(`订单数 ${count} ≥ 阈值 ${cfg.thresholdCount}`);
        if (totalWei >= thresholdAmountWei) reasons.push(`总额 ${(Number(totalWei) / 1e18).toFixed(4)} ETH ≥ ${cfg.thresholdAmountEth} ETH`);

        return {
            seller: g.seller,
            count,
            oldestTimestamp: oldestTs,
            ageHours: +(ageMs / 3600000).toFixed(2),
            totalAmount: totalWei.toString(),
            ready: reasons.length > 0,
            reasons,
            nextCutoffMs: Math.max(0, cutoffMs - ageMs)
        };
    });
    // ready 的排前面，其次按等待时长降序
    groups.sort((a, b) => (b.ready - a.ready) || (b.ageHours - a.ageHours));

    res.json({ config: cfg, groups, totalPending: pending.length });
});

// 买家取消待上链订单（仅 pending 状态可取消，需买家签名）
app.post('/api/orders/cancel', (req, res) => {
    const { orderId, message, signature } = req.body || {};
    const id = parseInt(orderId, 10);
    const orders = loadOrders();
    const order = orders[id];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending') {
        return res.status(400).json({ error: '只有待上链的订单可以取消，已上链订单请走争议流程' });
    }
    const expectedMsg = `CancelOrder\norderId=${id}\nbuyer=${order.buyerAddress.toLowerCase()}`;
    if (message !== expectedMsg) {
        return res.status(400).json({ error: '取消消息格式错误' });
    }
    try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== order.buyerAddress.toLowerCase()) {
            return res.status(400).json({ error: '签名与买家地址不匹配' });
        }
    } catch (e) {
        return res.status(400).json({ error: '签名验证失败：' + e.message });
    }
    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    saveOrders(orders);
    res.json({ success: true, order });
});

// ==================== 服务端自动汇总（无需团长在线） ====================
const LEADER_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const ORDER_STORAGE_ABI = [
    "function batchCreateAndGroup(address[],uint256[],uint256[]) returns (uint256, uint256[])",
    "function nextOrderId() view returns (uint256)",
    "function nextGroupId() view returns (uint256)"
];

let autoSubmitRunning = false;
let autoSubmitInterval = null;

function getReadyGroups() {
    const cfg = loadLeaderConfig();
    const orders = loadOrders();
    const pending = orders.filter(o => o.status === 'pending');
    if (pending.length === 0) return { ready: false, pending: [] };
    const now = Date.now();
    const cutoffMs = cfg.cutoffHours * 3600 * 1000;
    const thresholdAmountWei = BigInt(Math.floor(cfg.thresholdAmountEth * 1e18));

    const grouped = {};
    for (const o of pending) {
        const seller = (o.sellerAddress || '').toLowerCase();
        if (!grouped[seller]) grouped[seller] = [];
        grouped[seller].push(o);
    }

    let anyReady = false;
    for (const seller of Object.keys(grouped)) {
        const group = grouped[seller];
        const oldestTs = Math.min(...group.map(o => o.timestamp || now));
        const ageMs = now - oldestTs;
        const totalWei = group.reduce((sum, o) => sum + BigInt(o.totalAmount || '0'), 0n);
        if (ageMs >= cutoffMs || group.length >= cfg.thresholdCount || totalWei >= thresholdAmountWei) {
            anyReady = true; break;
        }
    }
    return { ready: anyReady, pending };
}

async function serverAutoSubmit() {
    if (autoSubmitRunning) return;
    const { ready, pending } = getReadyGroups();
    if (!ready || pending.length === 0) return;

    autoSubmitRunning = true;
    console.log(`⚡ [自动汇总] 检测到就绪条件，${pending.length} 笔订单自动上链...`);
    try {
        const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(LEADER_PRIVATE_KEY, provider);
        const orderStorage = new ethers.Contract(addrs.orderStorage, ORDER_STORAGE_ABI, wallet);

        const buyers = pending.map(o => o.buyerAddress);
        const productIds = pending.map(o => o.productId);
        const quantities = pending.map(o => o.quantity);

        const tx = await orderStorage.batchCreateAndGroup(buyers, productIds, quantities);
        const receipt = await tx.wait();

        // 读取链上结果
        const startOrderId = Number(await orderStorage.nextOrderId()) - pending.length;

        // 更新链下订单状态
        const orders = loadOrders();
        pending.forEach((p, i) => {
            if (orders[p.id]) {
                orders[p.id].status = 'submitted';
                orders[p.id].onChainOrderId = startOrderId + i;
            }
        });
        saveOrders(orders);

        const endGroupId = Number(await orderStorage.nextGroupId());
        console.log(`✅ [自动汇总] 完成！${pending.length} 笔订单已上链，批次截止ID: ${endGroupId}`);
    } catch (e) {
        if (!e.message.includes('could not coalesce error') && !e.message.includes('failed to detect network')) {
            console.error(`❌ [自动汇总] 失败：${e.message}`);
        }
    } finally {
        autoSubmitRunning = false;
    }
}

// 异步 TCP 端口可用性探测器（默默检查 geth 节点是否开启，防止 ethers.js 疯狂报错刷屏）
function isRpcAlive() {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(8545, '127.0.0.1');
    });
}

// 每 30 秒检测一次就绪状态，自动提交
function startAutoSubmitDaemon() {
    if (autoSubmitInterval) return;
    autoSubmitInterval = setInterval(async () => {
        // 先静默检测本地 8545 Geth RPC 端口是否在线
        const alive = await isRpcAlive();
        if (!alive) {
            // 如果 Geth 没开，直接静默退出（不打印任何信息，绝不烦人刷屏）
            return;
        }
        await serverAutoSubmit();
        await serverAutoStartReconciliation();
        await serverAutoProposeSettlement(); // 顺便进行自动清算方案提出检测
    }, 15000); // 缩短为 15 秒检查，让体验更快
    console.log('🤖 服务端自动汇总、自动对账与自动清算守护进程已启动（每 15 秒检测）');
}

// ==================== 服务端自动提出清算 ====================
const RECONCILIATION_ABI = [
    "function nextBatchId() view returns (uint256)",
    "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 groupId,uint256 startTime,uint256 endTime,bool leaderSubmitted,bool sellerSubmitted,bool completed,uint256 matchedCount,uint256 mismatchedCount,address leader,address seller))",
    "function startReconciliationWithLeaderBill(uint256,uint256[],uint256[]) returns (uint256)"
];
const SETTLEMENT_ABI = [
    "function nextBatchId() view returns (uint256)",
    "function proposeSettlement(uint256) returns (uint256)",
    "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 reconciliationBatchId,uint256 proposedAt,uint256 executedAt,uint8 status,uint256 totalPayout,uint256 settledCount))"
];
const MULTISIG_ABI = [
    "function submitRestrictedTransaction(address,uint256,bytes,address[])",
    "function getTransactionCount() view returns (uint256)",
    "function getTransaction(uint256) view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations)"
];
const ORDER_STORAGE_ABI_FOR_SERVER = [
    "function nextGroupId() view returns (uint256)",
    "function getGroup(uint256) view returns (uint256 groupId,address leader,uint256[] orderIds,uint256 totalAmount,uint256 createdAt,bool finalized)",
    "function getGroupOrders(uint256) view returns (tuple(uint256 orderId,uint256 productId,address buyer,address seller,uint256 quantity,uint256 amount,uint256 timestamp,uint256 groupId,bool reconciled,bool disputed)[])",
    "event GroupFinalized(uint256 indexed groupId, uint256 orderCount, uint256 totalAmount)"
];

let autoProposeRunning = false;
let autoReconRunning = false;
let reconWatcherStarted = false;
const pendingReconGroups = new Set();

async function serverAutoStartReconciliation() {
    if (autoReconRunning) return;
    autoReconRunning = true;
    try {
        const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(LEADER_PRIVATE_KEY, provider);
        const reconContract = new ethers.Contract(addrs.reconciliation, RECONCILIATION_ABI, wallet);
        const orderStorageContract = new ethers.Contract(addrs.orderStorage, ORDER_STORAGE_ABI_FOR_SERVER, provider);

        const totalReconBatches = Number(await reconContract.nextBatchId());
        const reconciledGroupIds = new Set();
        for (let r = 0; r < totalReconBatches; r++) {
            const rb = await reconContract.getBatch(r);
            reconciledGroupIds.add(Number(rb.groupId));
        }

        const totalGroups = Number(await orderStorageContract.nextGroupId());
        for (let g = 0; g < totalGroups; g++) {
            if (reconciledGroupIds.has(g)) continue;
            const [, leader, orderIds, , , finalized] = await orderStorageContract.getGroup(g);
            if (!finalized || orderIds.length === 0) continue;
            if (leader.toLowerCase() !== wallet.address.toLowerCase()) continue;

            const groupOrders = await orderStorageContract.getGroupOrders(g);
            const billOrderIds = groupOrders.map(o => o.orderId);
            const amounts = groupOrders.map(o => o.amount);
            if (billOrderIds.length === 0) continue;

            console.log(`⚡ [自动对账] 检测到团购批次 #${g} 已汇总，自动发起对账并提交团长账单...`);
            const nonce = await wallet.getNonce("pending");
            const tx = await reconContract.startReconciliationWithLeaderBill(g, billOrderIds, amounts, { nonce });
            await tx.wait();
            const reconBatchId = Number(await reconContract.nextBatchId()) - 1;
            console.log(`✅ [自动对账] 已为团购批次 #${g} 创建对账批次 #${reconBatchId}，团长账单已提交！`);
        }
    } catch (e) {
        if (!e.message.includes('could not coalesce error') && !e.message.includes('failed to detect network')) {
            console.error(`❌ [自动对账] 失败：${e.message}`);
        }
    } finally {
        autoReconRunning = false;
    }
}

async function serverAutoProposeSettlement() {
    if (autoProposeRunning) return;
    autoProposeRunning = true;
    try {
        const addrs = JSON.parse(fs.readFileSync(ADDRESSES_FILE, 'utf8'));
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(LEADER_PRIVATE_KEY, provider);

        const reconContract = new ethers.Contract(addrs.reconciliation, RECONCILIATION_ABI, provider);
        const settleContract = new ethers.Contract(addrs.settlement, SETTLEMENT_ABI, wallet);
        const multisigContract = new ethers.Contract(addrs.multisig, MULTISIG_ABI, wallet);
        const orderStorageContract = new ethers.Contract(addrs.orderStorage, ORDER_STORAGE_ABI_FOR_SERVER, provider);

        const totalReconBatches = Number(await reconContract.nextBatchId());
        if (totalReconBatches === 0) { autoProposeRunning = false; return; }

        const settlementIface = new ethers.Interface(["function approveSettlement(uint256)"]);

        async function hasMultisigApprovalTx(settlementBatchId) {
            const txCount = Number(await multisigContract.getTransactionCount());
            const expectedData = settlementIface.encodeFunctionData("approveSettlement", [settlementBatchId]).toLowerCase();
            for (let i = 0; i < txCount; i++) {
                const t = await multisigContract.getTransaction(i);
                if (t.to.toLowerCase() === addrs.settlement.toLowerCase() && String(t.data).toLowerCase() === expectedData) {
                    return true;
                }
            }
            return false;
        }

        async function submitSettlementApprovalToMultisig(settlementBatchId, groupId, nonce) {
            console.log(`⚡ [自动清算] 正在将清算方案 #${settlementBatchId} 自动提交至多签钱包...`);
            const groupOrders = await orderStorageContract.getGroupOrders(Number(groupId));
            const allowedConfirmers = [...new Set([
                '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb',
                ...groupOrders.map(o => o.seller.toLowerCase()),
                ...groupOrders.map(o => o.buyer.toLowerCase())
            ])];
            const data = settlementIface.encodeFunctionData("approveSettlement", [settlementBatchId]);
            const dataBytes = ethers.getBytes(data);
            const msTx = await multisigContract.submitRestrictedTransaction(
                addrs.settlement,
                0,
                dataBytes,
                allowedConfirmers,
                { nonce }
            );
            await msTx.wait();
            console.log(`✅ [自动清算] 已成功在多签钱包中自动创建“审批清算方案”提案！`);
        }

        // 获取所有已提出清算的 reconciliationBatchId 集合，防止重复触发
        const totalSettleBatches = Number(await settleContract.nextBatchId());
        const proposedReconIds = new Set();
        const reconToSettlementId = new Map();
        for (let s = 0; s < totalSettleBatches; s++) {
            const sb = await settleContract.getBatch(s);
            const reconId = Number(sb.reconciliationBatchId);
            proposedReconIds.add(reconId);
            reconToSettlementId.set(reconId, s);
        }

        // 遍历对账批次
        for (let r = 0; r < totalReconBatches; r++) {
            const b = await reconContract.getBatch(r);
            if (proposedReconIds.has(r)) {
                const settlementBatchId = reconToSettlementId.get(r);
                if (b.completed && Number(b.mismatchedCount) === 0 && !(await hasMultisigApprovalTx(settlementBatchId))) {
                    const nonce = await wallet.getNonce("pending");
                    await submitSettlementApprovalToMultisig(settlementBatchId, Number(b.groupId), nonce);
                }
                continue;
            }

            // 自动进入清算条件：对账已完成、无差异、未被清算
            if (b.completed && Number(b.mismatchedCount) === 0) {
                console.log(`⚡ [自动清算] 检测到对账批次 #${r} 无误完成，开始自动生成清算方案...`);
                const baseNonce = await wallet.getNonce("pending");
                let nonce = baseNonce;
                const tx = await settleContract.proposeSettlement(r, { nonce });
                await tx.wait();
                
                const settlementBatchId = Number(await settleContract.nextBatchId()) - 1;
                console.log(`✅ [自动清算] 已为对账批次 #${r} 成功提出清算方案 #${settlementBatchId}！`);

                // 🌟 新增：自动把清算方案提交到多签钱包！
                nonce = baseNonce + 1;
                await submitSettlementApprovalToMultisig(settlementBatchId, Number(b.groupId), nonce);
            }
        }
    } catch (e) {
        // 如果是连接错误，静默不报错
        if (!e.message.includes('could not coalesce error') && !e.message.includes('failed to detect network')) {
            console.error(`❌ [自动清算] 失败：${e.message}`);
        }
    } finally {
        autoProposeRunning = false;
    }
}

// 开关接口：前端可查看/控制服务端自动提交
app.get('/api/auto-submit/status', (req, res) => {
    res.json({ enabled: !!autoSubmitInterval, running: autoSubmitRunning });
});

app.post('/api/auto-submit/toggle', (req, res) => {
    const { enabled } = req.body || {};
    if (enabled) {
        startAutoSubmitDaemon();
    } else {
        if (autoSubmitInterval) { clearInterval(autoSubmitInterval); autoSubmitInterval = null; }
        console.log('🤖 服务端自动汇总守护进程已停止');
    }
    res.json({ enabled: !!autoSubmitInterval });
});

// Serve static files
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/vendor/ethers.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js'));
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Debug route
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'debug.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}/`);
    console.log(`📱 Main app: http://localhost:${port}/`);
    console.log('');
    console.log('💡 MetaMask Setup:');
    console.log('   RPC URL: http://localhost:8545 | Chain ID: 887766');
    console.log('');
    console.log('📋 角色账户:');
    console.log('   管理员/团长: 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb');
    console.log('   商家A:      0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63');
    console.log('   商家B:      0x41D0399A2002c6DAFB0C00Ce4E3aFdC3D8E53660');
    console.log('   买家1:      0x83d0066B956aD53CA640B3446A87eF8c26CDEf97');
    console.log('   买家2:      0xB9be241549418558776f510CB9167673CaEaF4C0');
    console.log('   买家3:      0xd34e3AC5d30D92C7b13fdb591FA41F00d9B4CB67');
    console.log('');
    console.log('✅ 买家下单走链下 API（无需 MetaMask）');
    console.log('✅ 多签审批需三方确认：团长 + 卖家 + 买家');
    console.log('');
    // 启动服务端自动汇总守护进程
    startAutoSubmitDaemon();
    // 启动实时对账监听，确保汇总后立刻创建“等待商家提交”的对账批次
    startRealtimeReconWatcher();
});
