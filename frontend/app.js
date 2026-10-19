// ==================== ABI Definitions ====================
const PRODUCT_REGISTRY_ABI = [
    "function createProduct(string,uint256,uint256) returns (uint256)",
    "function updateProduct(uint256,uint256,uint256)",
    "function deactivateProduct(uint256)",
    "function getProduct(uint256) view returns (tuple(uint256 productId,string name,uint256 price,address seller,uint256 stock,bool active,uint256 createdAt))",
    "function getActiveProducts() view returns (tuple(uint256 productId,string name,uint256 price,address seller,uint256 stock,bool active,uint256 createdAt)[])",
    "function nextProductId() view returns (uint256)",
    "event ProductCreated(uint256 indexed productId, string name, uint256 price, address indexed seller)"
];

const ORDER_STORAGE_ABI = [
    "function placeOrder(uint256,uint256) returns (uint256)",
    "function batchCreateOrders(address[],uint256[],uint256[]) returns (uint256)",
    "function batchCreateAndGroup(address[],uint256[],uint256[]) returns (uint256, uint256[])",
    "function createGroup() returns (uint256)",
    "function addOrdersToGroup(uint256,uint256[])",
    "function finalizeGroup(uint256)",
    "function getOrder(uint256) view returns (tuple(uint256 orderId,uint256 productId,address buyer,address seller,uint256 quantity,uint256 amount,uint256 timestamp,uint256 groupId,bool reconciled,bool disputed))",
    "function getGroup(uint256) view returns (uint256,address,uint256[],uint256,uint256,bool)",
    "function getOrdersByBuyer(address) view returns (tuple(uint256 orderId,uint256 productId,address buyer,address seller,uint256 quantity,uint256 amount,uint256 timestamp,uint256 groupId,bool reconciled,bool disputed)[])",
    "function getGroupOrders(uint256) view returns (tuple(uint256 orderId,uint256 productId,address buyer,address seller,uint256 quantity,uint256 amount,uint256 timestamp,uint256 groupId,bool reconciled,bool disputed)[])",
    "function nextOrderId() view returns (uint256)",
    "function batchGroupAndFinalize(uint256[][]) returns (uint256[])",
    "function nextGroupId() view returns (uint256)",
    "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 productId, uint256 quantity, uint256 amount)",
    "event GroupCreated(uint256 indexed groupId, address indexed leader)",
    "event GroupFinalized(uint256 indexed groupId, uint256 orderCount, uint256 totalAmount)"
];

const RECONCILIATION_ABI = [
    "function startReconciliation(uint256) returns (uint256)",
    "function startReconciliationWithLeaderBill(uint256,uint256[],uint256[]) returns (uint256)",
    "function submitLeaderBill(uint256,uint256[],uint256[])",
    "function submitSellerBill(uint256,uint256[],uint256[])",
    "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 groupId,uint256 startTime,uint256 endTime,bool leaderSubmitted,bool sellerSubmitted,bool completed,uint256 matchedCount,uint256 mismatchedCount,address leader,address seller))",
    "function getReconciledOrders(uint256) view returns (uint256[])",
    "function getMismatchedOrders(uint256) view returns (uint256[])",
    "function nextBatchId() view returns (uint256)",
    "event ReconciliationStarted(uint256 indexed batchId, uint256 indexed groupId, uint256 startTime)",
    "event ReconciliationCompleted(uint256 indexed batchId, uint256 matchedCount, uint256 mismatchedCount)"
];

const SETTLEMENT_ABI = [
    "function proposeSettlement(uint256) returns (uint256)",
    "function approveSettlement(uint256)",
    "function executeSettlement(uint256) payable",
    "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 reconciliationBatchId,uint256 proposedAt,uint256 executedAt,uint8 status,uint256 totalPayout,uint256 settledCount))",
    "function getNetPositions(uint256) view returns (tuple(address participant,int256 netAmount)[])",
    "function nextBatchId() view returns (uint256)",
    "function getEscrowInfo() view returns (uint256,uint256)",
    "function escrowDeposits(address) view returns (uint256)",
    "function depositEscrow() payable",
    "event SettlementProposed(uint256 indexed batchId, uint256 indexed reconBatchId, uint256 totalPayout)",
    "event SettlementExecuted(uint256 indexed batchId, uint256 settledCount, uint256 totalPaid)"
];

const DISPUTE_ABI = [
    "function createDispute(uint256,string) returns (uint256)",
    "function assignArbitrator(uint256)",
    "function submitEvidence(uint256,string)",
    "function resolveDispute(uint256,bool,uint256)",
    "function executeDispute(uint256)",
    "function nextDisputeId() view returns (uint256)",
    "function getDispute(uint256) view returns (tuple(uint256 disputeId,uint256 orderId,address initiator,string reason,uint8 status,address arbitrator,bool sellerAtFault,uint256 settlementAmount,uint256 createdAt,uint256 resolvedAt))",
    "event DisputeCreated(uint256 indexed disputeId, uint256 indexed orderId, address indexed initiator, string reason)",
    "event DisputeResolved(uint256 indexed disputeId, uint256 indexed orderId, bool sellerAtFault, uint256 settlementAmount)"
];

const MULTISIG_ABI = [
    "function submitTransaction(address,uint256,bytes) returns (uint256)",
    "function submitRestrictedTransaction(address,uint256,bytes,address[]) returns (uint256)",
    "function confirmTransaction(uint256)",
    "function executeTransaction(uint256)",
    "function getOwners() view returns (address[])",
    "function required() view returns (uint256)",
    "function getTransactionCount() view returns (uint256)",
    "function getTransaction(uint256) view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations)",
    "function isConfirmed(uint256,address) view returns (bool)",
    "function isAllowedConfirmer(uint256,address) view returns (bool)",
    "function getAllowedConfirmers(uint256) view returns (address[])",
    "event SubmitTransaction(address indexed owner, uint256 indexed txIndex)",
    "event ExecuteTransaction(address indexed owner, uint256 indexed txIndex)",
    "receive() payable"
];

// ==================== Contract Addresses ====================
const DEFAULT_ADDRESSES = {
    productRegistry: "0x7a67Cd67A8283BCBbEB53136Cf83a7a6729d9269",
    orderStorage: "0x342a8FA38C1e8118cD7cDDB3af3e9C156958afd2",
    reconciliation: "0xd712770C608Ea7E82C719f85673D4Eb3932C2525",
    settlement: "0xc4a26B4B5c2ad89C95efD303bCFA94ED03f7Afcc",
    dispute: "0x41bEb821E710Ea08b983A130C35d6f769Ebb5c4B",
    multisig: "0xc010C027c557dB20F5A0cE653Cca257A3De24843"
};
let CONTRACT_ADDRESSES = Object.assign({}, DEFAULT_ADDRESSES);

async function loadContractAddresses() {
    try {
        const resp = await fetch('/data/addresses.json', { cache: 'no-store' });
        if (resp.ok) {
            const addrs = await resp.json();
            // 使用后端最新地址覆盖默认值
            CONTRACT_ADDRESSES = Object.assign({}, DEFAULT_ADDRESSES, addrs);
        }

// 管理员执行裁决：卖方责任时，退款原路退回到买家预存（Settlement escrow）
async function executeDispute(disputeId) {
    try {
        showStatus('执行退款中...', 'warning', 'disputeStatus');
        let fee;
        try {
            const feeData = await provider.getFeeData();
            const base = feeData.maxFeePerGas || parseUnitsSafe('1', 'gwei');
            const tip = feeData.maxPriorityFeePerGas || parseUnitsSafe('0', 'gwei');
            fee = { maxFeePerGas: base, maxPriorityFeePerGas: tip };
        } catch (_) { fee = {}; }
        const tx = await contracts.dispute.executeDispute(disputeId, { gasLimit: 200000, ...fee });
        await tx.wait();
        showStatus('✅ 退款执行完成！', 'success', 'disputeStatus');
        await loadDisputes();
        if (typeof loadBuyerPaymentInfo === 'function') await loadBuyerPaymentInfo();
    } catch (e) { showStatus('执行失败：' + e.message, 'error', 'disputeStatus'); }
}
    } catch (_) {
        // 忽略，继续使用默认内置地址（兼容老环境）
    }
}

// ==================== Global State ====================
let provider, signer, userAddress;
let lastKnownAccount = null;
const contracts = {};
const isEthersV6 = typeof ethers.BrowserProvider !== 'undefined';

function formatEtherSafe(value) {
    return isEthersV6 ? ethers.formatEther(value) : ethers.utils.formatEther(value);
}
function parseEtherSafe(value) {
    return isEthersV6 ? ethers.parseEther(value) : ethers.utils.parseEther(value);
}
function toNumberSafe(value) {
    return isEthersV6 ? Number(value) : value.toNumber();
}
function parseUnitsSafe(value, unit) {
    return isEthersV6 ? ethers.parseUnits(value, unit) : ethers.utils.parseUnits(value, unit);
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            loadTabData(tab.dataset.tab);
        });
    });

    // Button listeners (safe binding: skip if element not in DOM or handler missing)
    function bind(id, handler) {
        if (typeof handler !== 'function') return;
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }
    bind('createProduct', createProduct);
    bind('placeOrder', placeOrder);
    bind('batchSubmitToChain', batchSubmitSelected);
    bind('createGroup', createGroup);
    bind('addToGroup', addOrdersToGroup);
    bind('finalizeGroup', finalizeGroup);
    bind('startReconciliation', startReconciliation);
    bind('submitLeaderBill', typeof submitLeaderBill === 'function' ? submitLeaderBill : null);
    bind('submitSellerBill', loadSellerBillPreview);
    bind('proposeSettlement', proposeSettlement);
    bind('submitApproval', submitApprovalToMultisig);
    bind('executeSettlement', executeSettlement);
    bind('createDispute', createDispute);
    bind('submitTransaction', submitTransaction);
    bind('confirmTransaction', confirmTransaction);
    bind('executeTransaction', executeTransaction);
    bind('depositToMultisig', depositToMultisig);

    // Order preview
    document.getElementById('orderProductId').addEventListener('change', updateOrderPreview);
    document.getElementById('orderQuantity').addEventListener('input', updateOrderPreview);

    checkWalletConnection();
});

async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            lastKnownAccount = accounts[0].toLowerCase();
            await connectWallet();
        }
        // 监听账户切换，自动刷新角色
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length > 0) {
                window.location.reload();
            } else {
                document.getElementById('walletAddress').textContent = '未连接';
                document.getElementById('userRole').textContent = '-';
                document.getElementById('connectWallet').textContent = '连接钱包';
                document.getElementById('connectWallet').disabled = false;
            }
        });

        // 兜底：部分浏览器/MetaMask 不触发 accountsChanged，定时检查账号变化
        setInterval(async () => {
            try {
                const latestAccounts = await window.ethereum.request({ method: 'eth_accounts' });
                const latest = latestAccounts[0] ? latestAccounts[0].toLowerCase() : null;
                if (lastKnownAccount && latest && latest !== lastKnownAccount) {
                    window.location.reload();
                }
                if (!lastKnownAccount && latest) {
                    lastKnownAccount = latest;
                }
            } catch (e) {
                console.warn('检查账户变化失败:', e);
            }
        }, 1000);
    }
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('请安装 MetaMask', 'error', 'globalStatus');
            return;
        }
        if (isEthersV6) {
            provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();
        } else {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
        }

        const network = await provider.getNetwork();
        const chainId = isEthersV6 ? Number(network.chainId) : network.chainId;
        if (chainId !== 887766) {
            showStatus('请切换到本地网络 (Chain ID: 887766)', 'error', 'globalStatus');
        }

        document.getElementById('walletAddress').textContent = addrName(userAddress);
        lastKnownAccount = userAddress.toLowerCase();
        document.getElementById('connectWallet').textContent = '已连接';
        document.getElementById('connectWallet').disabled = true;

        await initializeContracts();
        await detectUserRole();
    } catch (error) {
        showStatus('连接钱包失败：' + error.message, 'error', 'globalStatus');
    }
}

async function initializeContracts() {
    await loadContractAddresses();
    contracts.productRegistry = new ethers.Contract(CONTRACT_ADDRESSES.productRegistry, PRODUCT_REGISTRY_ABI, signer);
    contracts.orderStorage = new ethers.Contract(CONTRACT_ADDRESSES.orderStorage, ORDER_STORAGE_ABI, signer);
    contracts.reconciliation = new ethers.Contract(CONTRACT_ADDRESSES.reconciliation, RECONCILIATION_ABI, signer);
    contracts.settlement = new ethers.Contract(CONTRACT_ADDRESSES.settlement, SETTLEMENT_ABI, signer);
    contracts.dispute = new ethers.Contract(CONTRACT_ADDRESSES.dispute, DISPUTE_ABI, signer);
    contracts.multisig = new ethers.Contract(CONTRACT_ADDRESSES.multisig, MULTISIG_ABI, signer);
}

// 角色账户映射
const ROLE_ACCOUNTS = {
    admin: "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
    sellerA: "0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63",
    sellerB: "0x41D0399A2002c6DAFB0C00Ce4E3aFdC3D8E53660",
    buyer1: "0x83d0066B956aD53CA640B3446A87eF8c26CDEf97",
    buyer2: "0xB9be241549418558776f510CB9167673CaEaF4C0",
    buyer3: "0xd34e3AC5d30D92C7b13fdb591FA41F00d9B4CB67",
};

// 地址 → 友好名称
const ADDRESS_NAMES = {};
ADDRESS_NAMES[ROLE_ACCOUNTS.admin.toLowerCase()]   = '团长';
ADDRESS_NAMES[ROLE_ACCOUNTS.sellerA.toLowerCase()] = '商家A';
ADDRESS_NAMES[ROLE_ACCOUNTS.sellerB.toLowerCase()] = '商家B';
ADDRESS_NAMES[ROLE_ACCOUNTS.buyer1.toLowerCase()]  = '买家1';
ADDRESS_NAMES[ROLE_ACCOUNTS.buyer2.toLowerCase()]  = '买家2';
ADDRESS_NAMES[ROLE_ACCOUNTS.buyer3.toLowerCase()]  = '买家3';

function addrName(addr) {
    if (!addr) return '-';
    return ADDRESS_NAMES[addr.toLowerCase()] || (addr.slice(0, 6) + '...' + addr.slice(-4));
}

// 每个角色可见的 tab
const ROLE_TABS = {
    admin:   ['products', 'reconciliation', 'settlement', 'disputes', 'multisig'],
    leader:  ['products', 'orders', 'reconciliation', 'settlement', 'disputes', 'multisig'],
    seller:  ['products', 'reconciliation', 'settlement', 'disputes', 'multisig'],
    buyer:   ['products', 'orders', 'settlement', 'disputes', 'multisig'],
};

let currentUserRole = 'buyer'; // 默认角色

async function detectUserRole() {
    const roleEl = document.getElementById('userRole');
    const addr = userAddress.toLowerCase();
    let roleName = '';
    let roleKey = '';

    if (addr === ROLE_ACCOUNTS.admin.toLowerCase()) {
        roleName = '团长 / 仲裁员';
        roleKey = 'leader';
    } else if (addr === ROLE_ACCOUNTS.sellerA.toLowerCase()) {
        roleName = '商家A';
        roleKey = 'seller';
    } else if (addr === ROLE_ACCOUNTS.sellerB.toLowerCase()) {
        roleName = '商家B';
        roleKey = 'seller';
    } else {
        roleName = '买家';
        roleKey = 'buyer';
    }

    currentUserRole = roleKey;
    roleEl.textContent = roleName;
    applyRoleVisibility(roleKey);

    // 侧边栏订单 tab 标签动态文案
    const ordersTabLabel = document.getElementById('ordersTabLabel');
    if (ordersTabLabel) {
        ordersTabLabel.textContent = (roleKey === 'leader' || roleKey === 'admin') ? '全部订单' : '我的订单';
    }

    // 检测用户身份变化时，触发对账红点更新
    await refreshReconciliationRedDot();
}

function applyRoleVisibility(roleKey) {
    const allowedTabs = ROLE_TABS[roleKey] || ROLE_TABS.buyer;

    // 显示/隐藏 tab 按钮
    document.querySelectorAll('.tab').forEach(btn => {
        const tabName = btn.dataset.tab;
        if (allowedTabs.includes(tabName)) {
            btn.style.display = '';
        } else {
            btn.style.display = 'none';
        }
    });

    // 重置 tab 内容的内联样式（让 CSS class 控制显隐）
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = '';
    });

    // 隐藏角色无关的操作区域
    const sellerOnlySections = document.querySelectorAll('[data-role="seller"]');
    const leaderOnlySections = document.querySelectorAll('[data-role="leader"]');
    const adminOnlySections = document.querySelectorAll('[data-role="admin"]');
    const buyerOnlySections = document.querySelectorAll('[data-role="buyer"]');

    const buyerSellerSections = document.querySelectorAll('[data-role="buyer-seller"]');

    sellerOnlySections.forEach(el => el.style.display = roleKey === 'seller' ? '' : 'none');
    leaderOnlySections.forEach(el => el.style.display = (roleKey === 'leader' || roleKey === 'admin') ? '' : 'none');
    adminOnlySections.forEach(el => el.style.display = roleKey === 'admin' ? '' : 'none');
    buyerOnlySections.forEach(el => el.style.display = roleKey === 'buyer' ? '' : 'none');
    buyerSellerSections.forEach(el => el.style.display = (roleKey === 'buyer' || roleKey === 'seller') ? '' : 'none');

    // 激活第一个可见的 tab
    const firstTab = document.querySelector(`.tab[data-tab="${allowedTabs[0]}"]`);
    if (firstTab) {
        firstTab.click();
    }
}

// ==================== Tab Loading ====================
async function loadTabData(tabName) {
    if (!provider) return;
    // 切走 orders 页时停止就绪状态轮询
    const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';
    if ((tabName !== 'orders' || !isLeader) && typeof stopReadinessPolling === 'function') stopReadinessPolling();
    try {
        switch(tabName) {
            case 'products': await loadProducts(); break;
            case 'orders': 
                await loadOrders(); 
                if (isLeader) {
                    await loadLeaderConfig();
                    startReadinessPolling();
                    bindGroupLeaderEvents();
                }
                break;
            case 'reconciliation': await loadReconciliationBatches(); break;
            case 'settlement': await loadSettlementBatches(); break;
            case 'disputes': await loadDisputes(); break;
            case 'multisig': await loadMultisig(); break;
        }
        // 任何 tab 切换时，都顺便检测并更新对账红点提示
        await refreshReconciliationRedDot();
        await refreshMultisigRedDot();
    } catch (error) {
        console.error(`Error loading ${tabName}:`, error);
    }
}

// 刷新多方对账菜单红点
async function refreshReconciliationRedDot() {
    const dot = document.getElementById('reconciliationRedDot');
    if (!dot) return;
    dot.style.display = 'none';
    if (currentUserRole !== 'seller' || !userAddress || !contracts.reconciliation || !contracts.orderStorage) return;

    try {
        const total = toNumberSafe(await contracts.reconciliation.nextBatchId());
        for (let i = 0; i < total; i++) {
            const b = await contracts.reconciliation.getBatch(i);
            if (b.completed || b.sellerSubmitted) continue;
            const groupOrders = await contracts.orderStorage.getGroupOrders(toNumberSafe(b.groupId));
            const needsMe = groupOrders.some(o => o.seller.toLowerCase() === userAddress.toLowerCase());
            if (needsMe) {
                dot.style.display = 'block';
                return;
            }
        }
    } catch (e) {
        console.warn('刷新对账红点失败:', e.message);
    }
}
window.refreshReconciliationRedDot = refreshReconciliationRedDot;

// 刷新多签钱包菜单红点（当当前地址是 owner，且存在未执行且我未确认的交易时显示）
async function refreshMultisigRedDot() {
    const dot = document.getElementById('multisigRedDot');
    if (!dot) return;
    dot.style.display = 'none';
    if (!userAddress || !contracts.multisig) return;

    try {
        const owners = await contracts.multisig.getOwners();
        const isOwner = owners.map(o => o.toLowerCase()).includes(userAddress.toLowerCase());
        if (!isOwner) return;

        const total = toNumberSafe(await contracts.multisig.getTransactionCount());
        const maxScan = Math.min(total, 50); // 扫描最近 50 条
        for (let k = 0; k < maxScan; k++) {
            const i = total - 1 - k;
            const [t, confirmedByMe] = await Promise.all([
                contracts.multisig.getTransaction(i),
                contracts.multisig.isConfirmed(i, userAddress)
            ]);
            if (!t.executed && !confirmedByMe) {
                dot.style.display = 'block';
                return;
            }
        }
    } catch (e) {
        console.warn('刷新多签红点失败:', e.message);
    }
}
window.refreshMultisigRedDot = refreshMultisigRedDot;

// ==================== Products ====================
async function createProduct() {
    try {
        const name = document.getElementById('productName').value;
        const price = parseEtherSafe(document.getElementById('productPrice').value);
        const stock = parseInt(document.getElementById('productStock').value);
        if (!name || !stock) { showStatus('请填写完整信息', 'error', 'productStatus'); return; }
        const tx = await contracts.productRegistry.createProduct(name, price, stock);
        showStatus('商品发布中...', 'warning', 'productStatus');
        await tx.wait();
        showStatus('商品发布成功！', 'success', 'productStatus');
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productStock').value = '';
        await loadProducts();
    } catch (e) { showStatus('发布失败：' + e.message, 'error', 'productStatus'); }
}

let cachedProducts = []; // 缓存原始商品数据，避免每次筛选都重新请求链上

async function loadProducts() {
    const list = document.getElementById('productsList');
    bindProductFilters();
    bindCart();
    renderCart();
    try {
        let products = await contracts.productRegistry.getActiveProducts();
        // 商家视角：只看自己的商品
        const titleEl = document.getElementById('productsListTitle');
        if (currentUserRole === 'seller') {
            const me = userAddress.toLowerCase();
            products = products.filter(p => p.seller.toLowerCase() === me);
            if (titleEl) titleEl.textContent = '我的商品';
        } else {
            if (titleEl) titleEl.textContent = '商品列表';
        }
        cachedProducts = products;
        // 填充商家筛选下拉（仅买家可见）
        populateSellerFilter(products);
        renderProducts();
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

function populateSellerFilter(products) {
    const sel = document.getElementById('filterSeller');
    if (!sel) return;
    const sellers = [...new Set(products.map(p => p.seller.toLowerCase()))];
    const current = sel.value;
    sel.innerHTML = '<option value="">全部商家</option>' +
        sellers.map(s => `<option value="${s}">${addrName(s)}</option>`).join('');
    // 保留之前选择
    if (sellers.includes(current)) sel.value = current;
}

function renderProducts() {
    const list = document.getElementById('productsList');
    const countEl = document.getElementById('productsCount');
    const keyword = (document.getElementById('filterKeyword')?.value || '').trim().toLowerCase();
    const sellerFilter = (document.getElementById('filterSeller')?.value || '').toLowerCase();
    const stockFilter = document.getElementById('filterStock')?.value || 'all';
    const sortBy = document.getElementById('filterSort')?.value || 'default';

    let products = cachedProducts.slice();
    if (keyword) products = products.filter(p => p.name.toLowerCase().includes(keyword));
    if (sellerFilter) products = products.filter(p => p.seller.toLowerCase() === sellerFilter);
    if (stockFilter !== 'all') {
        products = products.filter(p => {
            const s = toNumberSafe(p.stock);
            if (stockFilter === 'inStock') return s > 0;
            if (stockFilter === 'lowStock') return s > 0 && s < 10;
            if (stockFilter === 'outOfStock') return s === 0;
            return true;
        });
    }
    // 排序（用 BigInt 比价格避免溢出）
    if (sortBy === 'priceAsc') products.sort((a, b) => (BigInt(a.price) < BigInt(b.price) ? -1 : 1));
    else if (sortBy === 'priceDesc') products.sort((a, b) => (BigInt(a.price) > BigInt(b.price) ? -1 : 1));
    else if (sortBy === 'stockDesc') products.sort((a, b) => toNumberSafe(b.stock) - toNumberSafe(a.stock));
    else if (sortBy === 'stockAsc') products.sort((a, b) => toNumberSafe(a.stock) - toNumberSafe(b.stock));

    if (countEl) {
        countEl.textContent = cachedProducts.length === products.length
            ? `共 ${products.length} 件`
            : `${products.length} / ${cachedProducts.length} 件（已筛选）`;
    }

    if (products.length === 0) {
        list.innerHTML = cachedProducts.length === 0
            ? (currentUserRole === 'seller'
                ? '<p style="color:var(--text-muted);">您还没有发布任何商品，使用上方"发布新商品"开始吧</p>'
                : '<p>暂无商品</p>')
            : '<p style="color:var(--text-muted);padding:30px;text-align:center;">没有匹配的商品，试试调整筛选条件</p>';
        return;
    }

    list.innerHTML = products.map(p => {
            const productId = toNumberSafe(p.productId);
            const priceEth = formatEtherSafe(p.price);
            const stock = toNumberSafe(p.stock);
            const canBuy = currentUserRole === 'buyer' && stock > 0;
            const isMyProduct = currentUserRole === 'seller'
                && p.seller.toLowerCase() === userAddress.toLowerCase();

            let stockChipClass = '';
            let stockText = `库存 ${stock} 件`;
            if (stock === 0) { stockChipClass = 'is-stock-out'; stockText = '已售罄'; }
            else if (stock < 10) { stockChipClass = 'is-stock-warn'; stockText = `仅剩 ${stock} 件`; }

            const buyBlock = canBuy ? `
                <div class="product-buy">
                    <div class="product-total">合计 <strong id="buyTotal-${productId}">${priceEth} ETH</strong></div>
                    <div class="product-buy-row">
                        <input type="number" min="1" max="${stock}" value="1" id="buyQty-${productId}">
                        <button class="btn btn-outline" style="padding:9px 14px;" onclick="addToCart(${productId})">加入购物车</button>
                        <button class="btn btn-success" style="padding:9px 18px;" onclick="quickPlaceOrder(${productId})">立即下单</button>
                    </div>
                </div>` : '';

            // 商家自己商品：编辑 + 下架
            const sellerBlock = isMyProduct ? `
                <div class="product-buy" style="gap:6px;">
                    <div class="product-price">${priceEth} <small>ETH</small></div>
                    <div class="product-buy-row">
                        <input type="text" id="editPrice-${productId}" placeholder="新单价" value="${priceEth}" style="width:90px;padding:7px;background:rgba(0,0,0,0.25);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;text-align:center;">
                        <input type="number" id="editStock-${productId}" placeholder="新库存" value="${stock}" min="0" style="width:80px;padding:7px;background:rgba(0,0,0,0.25);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;text-align:center;">
                    </div>
                    <div class="product-buy-row">
                        <button class="btn btn-success" style="padding:7px 14px;font-size:0.85em;" onclick="updateMyProduct(${productId})">更新</button>
                        <button class="btn btn-danger" style="padding:7px 14px;font-size:0.85em;" onclick="deactivateMyProduct(${productId})">下架</button>
                    </div>
                </div>` : '';

            const fallbackBlock = `<div class="product-buy"><div class="product-price">${priceEth} <small>ETH</small></div></div>`;
            const rightBlock = canBuy ? buyBlock : (isMyProduct ? sellerBlock : fallbackBlock);

            return `<div class="product-card">
                <div>
                    <h4>${p.name}</h4>
                    <div class="product-meta">
                        <span class="product-chip is-seller">${addrName(p.seller)}</span>
                        <span class="product-chip ${stockChipClass}">${stockText}</span>
                    </div>
                </div>
                ${rightBlock}
            </div>`;
        }).join('');

        // 绑定数量输入框实时更新合计 + clamp 到库存
        if (currentUserRole === 'buyer') {
            products.forEach(p => {
                const productId = toNumberSafe(p.productId);
                const stock = toNumberSafe(p.stock);
                const input = document.getElementById(`buyQty-${productId}`);
                const total = document.getElementById(`buyTotal-${productId}`);
                if (input && total) {
                    const priceWei = BigInt(p.price.toString());
                    const sync = (clamp) => {
                        let qty = parseInt(input.value, 10);
                        if (isNaN(qty) || qty < 0) qty = 0;
                        if (clamp) {
                            if (qty < 1) qty = 1;
                            if (qty > stock) qty = stock;
                            input.value = qty;
                        }
                        const totalWei = priceWei * BigInt(Math.max(qty, 0));
                        total.textContent = `${formatEtherSafe(totalWei)} ETH`;
                    };
                    input.addEventListener('input', () => sync(false));
                    input.addEventListener('blur', () => sync(true));
                }
            });
        }

        // 订单下拉框（用全量缓存而非筛选后的）
        const select = document.getElementById('orderProductId');
        if (select) {
            select.innerHTML = '<option value="">-- 选择商品 --</option>' +
                cachedProducts.map(p => `<option value="${toNumberSafe(p.productId)}" data-price="${formatEtherSafe(p.price)}" data-name="${p.name}">${p.name} - ${formatEtherSafe(p.price)} ETH (库存:${toNumberSafe(p.stock)})</option>`).join('');
        }
}

// 绑定筛选控件（页面加载时调用一次）
function bindProductFilters() {
    const ids = ['filterKeyword', 'filterSeller', 'filterStock', 'filterSort'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.bound) return;
        const ev = el.tagName === 'INPUT' ? 'input' : 'change';
        el.addEventListener(ev, renderProducts);
        el.dataset.bound = '1';
    });
    const reset = document.getElementById('filterReset');
    if (reset && !reset.dataset.bound) {
        reset.addEventListener('click', () => {
            document.getElementById('filterKeyword').value = '';
            document.getElementById('filterSeller').value = '';
            document.getElementById('filterStock').value = 'all';
            document.getElementById('filterSort').value = 'default';
            renderProducts();
        });
        reset.dataset.bound = '1';
    }
}

// 商品卡片里一键下单
async function quickPlaceOrder(productId) {
    const input = document.getElementById(`buyQty-${productId}`);
    const qty = parseInt(input.value, 10);
    const max = parseInt(input.max, 10);
    if (isNaN(qty) || qty <= 0 || qty !== Number(input.value)) {
        showStatus('请输入有效的正整数数量', 'error', 'productStatus');
        return;
    }
    if (!isNaN(max) && qty > max) {
        showStatus(`数量超过库存上限 ${max}`, 'error', 'productStatus');
        input.value = max;
        return;
    }
    // 复用原有 placeOrder 逻辑：填充隐藏表单后调用
    document.getElementById('orderProductId').value = productId;
    document.getElementById('orderQuantity').value = qty;
    await placeOrder();
}
window.quickPlaceOrder = quickPlaceOrder;

// ==================== 购物车 ====================
const CART_KEY = 'cgb_cart_v1';
function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
}
function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCart();
}
function findProductInCache(productId) {
    return cachedProducts.find(p => toNumberSafe(p.productId) === Number(productId));
}
function addToCart(productId) {
    const p = findProductInCache(productId);
    if (!p) { showStatus('商品不存在', 'error', 'productStatus'); return; }
    const stock = toNumberSafe(p.stock);
    const input = document.getElementById(`buyQty-${productId}`);
    const qty = parseInt(input?.value || '1', 10);
    if (isNaN(qty) || qty <= 0) { showStatus('请输入有效数量', 'error', 'productStatus'); return; }
    if (qty > stock) { showStatus(`数量超过库存上限 ${stock}`, 'error', 'productStatus'); return; }

    const items = getCart();
    const existing = items.find(it => it.productId === Number(productId));
    if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > stock) {
            showStatus(`累计 ${newQty} 超过库存 ${stock}`, 'error', 'productStatus');
            return;
        }
        existing.quantity = newQty;
    } else {
        items.push({
            productId: Number(productId),
            productName: p.name,
            seller: p.seller,
            unitPrice: p.price.toString(),
            quantity: qty
        });
    }
    saveCart(items);
    showStatus(`已加入购物车：${p.name} × ${qty}`, 'success', 'productStatus');
}
window.addToCart = addToCart;

function removeFromCart(productId) {
    saveCart(getCart().filter(it => it.productId !== Number(productId)));
}
window.removeFromCart = removeFromCart;

function updateCartQty(productId, qty) {
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return removeFromCart(productId);
    const items = getCart();
    const it = items.find(x => x.productId === Number(productId));
    if (!it) return;
    const p = findProductInCache(productId);
    const stock = p ? toNumberSafe(p.stock) : Infinity;
    it.quantity = Math.min(q, stock);
    saveCart(items);
}
window.updateCartQty = updateCartQty;

function renderCart() {
    const panel = document.getElementById('cartPanel');
    if (!panel || currentUserRole !== 'buyer') return;
    const items = getCart();
    const countEl = document.getElementById('cartCount');
    const totalEl = document.getElementById('cartTotal');
    const itemsEl = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('cartCheckout');

    let totalCount = 0;
    let totalWei = 0n;
    for (const it of items) {
        totalCount += it.quantity;
        totalWei += BigInt(it.unitPrice) * BigInt(it.quantity);
    }
    countEl.textContent = totalCount;
    totalEl.textContent = `${formatEtherSafe(totalWei)} ETH`;
    if (checkoutBtn) {
        checkoutBtn.textContent = items.length === 0 ? '购物车为空' : `结算 (签 ${items.length} 次)`;
        checkoutBtn.disabled = items.length === 0;
    }

    if (items.length === 0) {
        itemsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">购物车是空的，去添加商品吧</p>';
        return;
    }
    itemsEl.innerHTML = items.map(it => {
        const subtotal = BigInt(it.unitPrice) * BigInt(it.quantity);
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:8px;">
            <div style="flex:1;">
                <div style="font-weight:500;">${it.productName}</div>
                <div style="font-size:0.8em;color:var(--text-muted);">${addrName(it.seller)} · ${formatEtherSafe(it.unitPrice)} ETH/件</div>
            </div>
            <input type="number" min="1" value="${it.quantity}" onchange="updateCartQty(${it.productId}, this.value)" style="width:70px;padding:6px;background:rgba(0,0,0,0.3);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;text-align:center;">
            <div style="min-width:90px;text-align:right;font-weight:600;">${formatEtherSafe(subtotal)} ETH</div>
            <button class="btn btn-outline" style="padding:5px 10px;font-size:0.85em;" onclick="removeFromCart(${it.productId})">移除</button>
        </div>`;
    }).join('');
}

// 批量结算：将购物车里的所有商品合并成一个包，只需【一键签名一次】！
async function checkoutCart() {
    const items = getCart();
    if (items.length === 0) return;
    if (!signer || !userAddress) {
        showStatus('请先连接钱包', 'error', 'cartStatus');
        return;
    }

    const itemsEl = document.getElementById('cartItems');
    if (itemsEl.style.display === 'none') itemsEl.style.display = 'block';

    showStatus(`⚡ 正在为您打包购物车商品（共 ${items.length} 件）...`, 'warning', 'cartStatus');

    try {
        const prepaid = BigInt(await contracts.settlement.escrowDeposits(userAddress));
        const reserved = await getBuyerReservedPrepaidAmount(userAddress);
        const cartTotal = items.reduce((sum, it) => sum + BigInt(it.unitPrice) * BigInt(it.quantity), 0n);
        const available = prepaid > reserved ? prepaid - reserved : 0n;
        if (cartTotal > available) {
            showStatus(`预存余额不足：购物车需 ${formatEtherSafe(cartTotal)} ETH，可用预存仅 ${formatEtherSafe(available)} ETH。请先在“我的订单”页面预存资金。`, 'error', 'cartStatus');
            return;
        }

        // 1. 在前端构造和后端完全匹配的合并批量账单
        const formattedItems = items.map(it => {
            const totalAmount = (BigInt(it.unitPrice) * BigInt(it.quantity)).toString();
            return {
                productId: Number(it.productId),
                quantity: Number(it.quantity),
                totalAmount
            };
        });

        // 2. 生成预期的批量合并 Message 文本
        const lines = [
            'CommunityGroupBuyingBulkOrders',
            `buyerAddress=${userAddress.toLowerCase()}`,
            `totalItems=${items.length}`
        ];
        formattedItems.forEach((it, i) => {
            lines.push(`Item#${i}: productId=${it.productId}, quantity=${it.quantity}, totalAmount=${it.totalAmount}`);
        });
        const bulkMessage = lines.join('\n');

        // 3. 唤起唯一的 1 次签名！
        showStatus(`✍️ 请在 MetaMask 中一键签署这份含有 ${items.length} 件商品的“打包账单”...`, 'warning', 'cartStatus');
        const signature = await signer.signMessage(bulkMessage);

        // 4. 发送给批量入库 API
        showStatus(`🛒 签名成功！正在一键极速入库...`, 'warning', 'cartStatus');
        const resp = await fetch('/api/orders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buyerAddress: userAddress,
                items: formattedItems,
                bulkMessage,
                signature
            })
        });

        const result = await resp.json();
        if (!result.success) {
            throw new Error(result.error || '后端批量拒绝');
        }

        // 5. 提示大获成功
        showStatus(`✅ 【一键打包下单】大获成功！全部 ${items.length} 件商品已创建订单并注入系统！<a href="#" onclick="document.querySelector('[data-tab=orders]').click();return false;" style="color:var(--accent-light);text-decoration:underline;margin-left:8px;">查看我的订单 →</a>`, 'success', 'cartStatus');
        saveCart([]);
    } catch (e) {
        showStatus('打包下单失败：' + (e.message || e), 'error', 'cartStatus');
    }

    await loadOrders();
    await loadProducts();
}
window.checkoutCart = checkoutCart;

// 绑定购物车按钮
function bindCart() {
    const toggle = document.getElementById('cartToggle');
    if (toggle && !toggle.dataset.bound) {
        toggle.addEventListener('click', () => {
            const items = document.getElementById('cartItems');
            items.style.display = items.style.display === 'none' ? 'block' : 'none';
        });
        toggle.dataset.bound = '1';
    }
    const clear = document.getElementById('cartClear');
    if (clear && !clear.dataset.bound) {
        clear.addEventListener('click', () => {
            if (getCart().length === 0) return;
            if (confirm('确认清空购物车？')) saveCart([]);
        });
        clear.dataset.bound = '1';
    }
    const checkout = document.getElementById('cartCheckout');
    if (checkout && !checkout.dataset.bound) {
        checkout.addEventListener('click', checkoutCart);
        checkout.dataset.bound = '1';
    }
}

// 商家更新自己商品的价格和库存
async function updateMyProduct(productId) {
    try {
        const priceStr = document.getElementById(`editPrice-${productId}`).value.trim();
        const stockStr = document.getElementById(`editStock-${productId}`).value.trim();
        const newPrice = parseEtherSafe(priceStr);
        const newStock = parseInt(stockStr, 10);
        if (!priceStr || isNaN(newStock) || newStock < 0) {
            showStatus('请输入有效的单价（ETH）和库存（非负整数）', 'error', 'productStatus');
            return;
        }
        if (newPrice === 0n || newPrice === BigInt(0)) {
            showStatus('单价必须大于 0', 'error', 'productStatus');
            return;
        }
        showStatus('正在提交更新...', 'warning', 'productStatus');
        const tx = await contracts.productRegistry.updateProduct(productId, newPrice, newStock);
        await tx.wait();
        showStatus('商品已更新', 'success', 'productStatus');
        await loadProducts();
    } catch (e) {
        showStatus('更新失败：' + (e.reason || e.message), 'error', 'productStatus');
    }
}
window.updateMyProduct = updateMyProduct;

// 商家下架自己商品
async function deactivateMyProduct(productId) {
    if (!confirm('确认下架此商品吗？下架后买家无法再下单，但已存在的订单不受影响。')) return;
    try {
        showStatus('正在下架商品...', 'warning', 'productStatus');
        const tx = await contracts.productRegistry.deactivateProduct(productId);
        await tx.wait();
        showStatus('商品已下架', 'success', 'productStatus');
        await loadProducts();
    } catch (e) {
        showStatus('下架失败：' + (e.reason || e.message), 'error', 'productStatus');
    }
}
window.deactivateMyProduct = deactivateMyProduct;

// 买家取消待上链订单
async function cancelPendingOrder(orderId) {
    if (!confirm('确认取消此订单吗？取消后无法恢复。')) return;
    try {
        const message = `CancelOrder\norderId=${orderId}\nbuyer=${userAddress.toLowerCase()}`;
        showStatus('请在 MetaMask 中签名以确认取消...', 'warning', 'orderStatus');
        const signature = await signer.signMessage(message);
        const resp = await fetch('/api/orders/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, message, signature })
        });
        const rawText = await resp.text();
        console.log('[cancel] HTTP', resp.status, 'body:', rawText);
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (e) {
            showStatus(`取消失败：服务端返回非 JSON（HTTP ${resp.status}），看控制台`, 'error', 'orderStatus');
            return;
        }
        if (result.success) {
            showStatus('订单已取消，库存已释放', 'success', 'orderStatus');
            await loadOrders();
            await loadProducts();
        } else {
            showStatus('取消失败：' + result.error, 'error', 'orderStatus');
        }
    } catch (e) {
        showStatus('取消失败：' + e.message, 'error', 'orderStatus');
    }
}
window.cancelPendingOrder = cancelPendingOrder;

// ==================== Orders ====================
function updateOrderPreview() {
    const select = document.getElementById('orderProductId');
    const qty = parseInt(document.getElementById('orderQuantity').value) || 0;
    const option = select.options[select.selectedIndex];
    const preview = document.getElementById('orderPreview');
    if (select.value && qty > 0) {
        const price = parseFloat(option.dataset.price);
        const total = (price * qty).toFixed(4);
        document.getElementById('orderPreviewText').textContent = `${option.dataset.name} x ${qty} = ${total} ETH`;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
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

// 买家下单：链下保存，买家钱包签名授权，团长后续批量上链
async function placeOrder() {
    try {
        const select = document.getElementById('orderProductId');
        const productId = parseInt(select.value);
        const quantity = parseInt(document.getElementById('orderQuantity').value);
        if (isNaN(productId) || isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
            showStatus('请选择商品并输入正整数数量', 'error', 'orderStatus'); return;
        }
        // 从链上读取商品信息（权威数据，含库存）
        const product = await contracts.productRegistry.getProduct(productId);
        if (!product.active) {
            showStatus('该商品已下架', 'error', 'productStatus'); return;
        }
        const stockNum = toNumberSafe(product.stock);
        if (quantity > stockNum) {
            showStatus(`数量超过库存（仅剩 ${stockNum} 件）`, 'error', 'productStatus'); return;
        }
        const unitPrice = product.price.toString();
        const totalAmount = (product.price * BigInt(quantity)).toString();

        const orderPayload = {
            buyerAddress: userAddress,
            productId,
            productName: product.name,
            sellerAddress: product.seller,
            quantity,
            unitPrice,
            totalAmount,
        };
        const orderMessage = buildOrderMessage(orderPayload);
        showStatus('请在 MetaMask 中签名确认订单内容...', 'warning', 'orderStatus');
        const signature = await signer.signMessage(orderMessage);

        // 调用链下 API 存储订单
        const resp = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...orderPayload,
                orderMessage,
                signature,
            })
        });
        const result = await resp.json();
        if (result.success) {
            // 同时显示在商品页和订单页的状态条
            const successMsg = '✅ 下单成功！订单已签名记录，等待团长批量上链。<a href="#" onclick="document.querySelector(\'[data-tab=orders]\').click();return false;" style="color:var(--accent-light);margin-left:10px;text-decoration:underline;">查看我的订单 →</a>';
            showStatus(successMsg, 'success', 'productStatus');
            showStatus(successMsg, 'success', 'orderStatus');
            document.getElementById('orderQuantity').value = '';
            await loadOrders();
            await loadProducts(); // 刷新库存
        } else {
            showStatus('下单失败：' + result.error, 'error', 'orderStatus');
        }
    } catch (e) { showStatus('下单失败：' + e.message, 'error', 'orderStatus'); }
}

// 加载订单：买家看自己的，团长/管理员看全部
async function loadOrders() {
    const list = document.getElementById('ordersList');
    // 动态标题
    const titleEl = document.getElementById('ordersPageTitle');
    const descEl = document.getElementById('ordersPageDesc');
    if (currentUserRole === 'leader' || currentUserRole === 'admin') {
        if (titleEl) titleEl.textContent = '全部订单';
        if (descEl) descEl.textContent = '查看所有买家订单状态，管理汇总流程';
    } else {
        if (titleEl) titleEl.textContent = '我的订单';
        if (descEl) descEl.textContent = '查看订单状态、预存货款、发起争议';
    }
    try {
        // 加载链下订单
        const queryParam = currentUserRole === 'buyer' ? `?buyer=${userAddress}` : '';
        const resp = await fetch('/api/orders' + queryParam);
        const offChainOrders = await resp.json();

        if (offChainOrders.length === 0) {
            await loadBuyerPaymentInfo();
            const cta = currentUserRole === 'buyer'
                ? `<button class="btn btn-success" style="margin-top:14px;" onclick="document.querySelector('[data-tab=products]').click()">去商品中心选购 &rarr;</button>`
                : '';
            list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <div style="font-size:2.5em;margin-bottom:12px;">&#128230;</div>
                <p>暂无订单${currentUserRole === 'buyer' ? '，快去挑选心仪商品吧' : ''}</p>
                ${cta}
            </div>`;
            return;
        }

        let html = '';
        let hasPending = false;
        
        for (let i = offChainOrders.length - 1; i >= Math.max(0, offChainOrders.length - 20); i--) {
            const o = offChainOrders[i];
            if (o.status === 'pending') hasPending = true;

            const statusMap = {
                pending: '⏳ 待上链',
                submitted: '✅ 已上链',
                grouped: '📦 已汇总',
                cancelled: '🚫 已取消'
            };
            const statusText = statusMap[o.status] || o.status;
            const amountEth = isEthersV6 ? ethers.formatEther(o.totalAmount) : ethers.utils.formatEther(o.totalAmount);
            const sigBadge = o.signatureValid
                ? `<span style="color:#51cf66;">✅ 买家签名已验证</span>`
                : `<span style="color:#ff6b6b;">⚠ 签名缺失</span>`;
            const sigShort = o.signature
                ? `${o.signature.slice(0, 10)}...${o.signature.slice(-8)}`
                : '-';
            const sigDetail = (currentUserRole === 'leader' || currentUserRole === 'admin') && o.signature ? `
                <details style="margin-top:8px;font-size:0.82em;color:var(--text-muted);">
                    <summary style="cursor:pointer;color:var(--accent-light);">查看买家签名凭证（团长上链依据）</summary>
                    <div style="margin-top:6px;word-break:break-all;line-height:1.5;">
                        <div><b>signature:</b> <code>${sigShort}</code></div>
                        <div style="margin-top:4px;"><b>orderMessage:</b><br><pre style="white-space:pre-wrap;background:rgba(0,0,0,0.25);padding:6px;border-radius:4px;">${(o.orderMessage || '').replace(/</g,'&lt;')}</pre></div>
                    </div>
                </details>` : '';
            // 买家在订单状态 submitted/grouped 下可以发起争议（还未对账完成）
            const canDispute = currentUserRole === 'buyer'
                && o.onChainOrderId !== null && o.onChainOrderId !== undefined
                && (o.status === 'submitted' || o.status === 'grouped');
            const disputeBtn = canDispute
                ? `<button class="btn btn-warning" style="margin-top:10px;margin-right:8px;padding:6px 14px;" onclick="quickCreateDispute(${o.onChainOrderId})">发起争议</button>`
                : '';
            // 买家可取消 pending 订单（还未上链，无需走争议）
            const canCancel = currentUserRole === 'buyer'
                && o.status === 'pending'
                && o.buyerAddress.toLowerCase() === userAddress.toLowerCase();
            const cancelBtn = canCancel
                ? `<button class="btn btn-danger" style="margin-top:10px;padding:6px 14px;" onclick="cancelPendingOrder(${o.id})">取消订单</button>`
                : '';
            const onChainTag = o.onChainOrderId !== null && o.onChainOrderId !== undefined
                ? `<span style="font-size:0.72em;color:var(--text-muted);font-weight:400;margin-left:8px;">链上凭证 #${o.onChainOrderId}</span>`
                : '';
            const cardOpacity = o.status === 'cancelled' ? 'opacity:0.55;' : '';

            // 如果是团长视角，且订单是 pending（待上链）状态，则渲染复选框
            const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';
            const checkboxEl = (isLeader && o.status === 'pending')
                ? `<input type="checkbox" class="pending-order-cb" value="${o.id}" style="width:18px;height:18px;accent-color:#2ee6d6;cursor:pointer;margin-right:12px;margin-top:2px;">`
                : '';

            html += `<div class="order-item" style="${cardOpacity}display:flex;align-items:flex-start;">
                ${checkboxEl}
                <div style="flex:1;">
                    <h4>${o.productName} × ${o.quantity}<span style="margin-left:auto;font-size:0.78em;font-weight:500;">${statusText}</span></h4>
                    <div class="order-details">
                        <div class="detail-item"><span class="detail-label">买家</span><span>${addrName(o.buyerAddress)}</span></div>
                        <div class="detail-item"><span class="detail-label">卖家</span><span>${addrName(o.sellerAddress)}</span></div>
                        <div class="detail-item"><span class="detail-label">金额</span><span>${amountEth} ETH</span></div>
                        <div class="detail-item"><span class="detail-label">买家签名</span>${sigBadge}${onChainTag}</div>
                    </div>
                    ${sigDetail}
                    ${disputeBtn}${cancelBtn}
                </div>
            </div>`;
        }

        // 如果团长有可以汇总的订单，我们在最顶端动态插入控制条
        const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';
        if (isLeader && hasPending) {
            const controlBar = `
                <div class="card" style="margin-bottom:16px;background:rgba(46, 230, 214, 0.05);border-color:rgba(46, 230, 214, 0.25);display:flex;align-items:center;justify-content:space-between;padding:12px 20px;">
                    <div style="font-size:0.88em;color:var(--text-secondary);">
                        🎯 发现未上链的零散订单，您可以直接勾选进行汇总
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button class="btn btn-outline" style="padding:5px 12px;font-size:0.82em;" onclick="toggleAllOrderCheckboxes(true)">全选</button>
                        <button class="btn btn-outline" style="padding:5px 12px;font-size:0.82em;" onclick="toggleAllOrderCheckboxes(false)">取消全选</button>
                        <button class="btn btn-success" style="padding:5px 16px;font-size:0.82em;" onclick="batchSubmitSelected()">一键汇总选中并上链 &rarr;</button>
                    </div>
                </div>
            `;
            html = controlBar + html;
        }

        list.innerHTML = html;
        await loadBuyerPaymentInfo();
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

// ==================== 买家预存货款 ====================
async function getBuyerReservedPrepaidAmount(buyerAddress) {
    const resp = await fetch(`/api/orders?buyer=${buyerAddress}`);
    const orders = await resp.json();
    return orders
        .filter(o => o.status === 'pending' || o.status === 'submitted' || o.status === 'grouped')
        .reduce((sum, o) => sum + BigInt(o.totalAmount || '0'), 0n);
}

async function loadBuyerPaymentInfo() {
    const container = document.getElementById('buyerPaymentInfo');
    if (!container) return;
    if (currentUserRole !== 'buyer') { container.style.display = 'none'; return; }
    
    try {
        const deposited = await contracts.settlement.escrowDeposits(userAddress);
        const depositedBN = BigInt(deposited);
        const reserved = await getBuyerReservedPrepaidAmount(userAddress);
        const available = depositedBN > reserved ? depositedBN - reserved : 0n;
        
        container.style.display = 'block';
        container.innerHTML = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
                <div><span style="color:var(--text-muted);">预存余额：</span><strong>${formatEtherSafe(depositedBN)} ETH</strong></div>
                <div><span style="color:var(--text-muted);">已花费：</span><strong>${formatEtherSafe(reserved)} ETH</strong></div>
                <div><span style="color:var(--text-muted);">可购买：</span><strong style="color:${available > 0n ? '#51cf66' : '#ff6b6b'};">${formatEtherSafe(available)} ETH</strong></div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <input id="depositEscrowAmount" type="text" placeholder="输入预存金额 ETH" style="width:180px;padding:8px;background:rgba(0,0,0,0.3);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;">
                <button id="depositEscrowBuyer" class="btn btn-success">预存</button>
            </div>
            <p style="font-size:0.82em;color:var(--text-muted);margin-top:8px;">下单会先检查“可购买额度”，超过预存可用余额将被拒绝；最终多签清算时自动从预存款中扣除。</p>
        `;
        
        document.getElementById('depositEscrowBuyer').addEventListener('click', async () => {
            try {
                const amount = document.getElementById('depositEscrowAmount').value.trim();
                if (!amount || Number(amount) <= 0) {
                    showStatus('请输入大于 0 的预存金额', 'error', 'orderStatus');
                    return;
                }
                showStatus('预存中...', 'warning', 'orderStatus');
                // 在本地链上显式设置较低的 EIP-1559 费用以避免夸张估算
                let fee;
                try {
                    const feeData = await provider.getFeeData();
                    const base = feeData.maxFeePerGas || parseUnitsSafe('1', 'gwei');
                    const tip = feeData.maxPriorityFeePerGas || parseUnitsSafe('0', 'gwei');
                    fee = { maxFeePerGas: base, maxPriorityFeePerGas: tip };
                } catch (_) {
                    fee = {};
                }
                // 直接调用合约的 depositEscrow()，而不是裸转账（Settlement 无 receive() 时裸转账会回退）
                const tx = await contracts.settlement.depositEscrow({
                    value: parseEtherSafe(amount),
                    gasLimit: 150000,
                    ...fee
                });
                await tx.wait();
                showStatus('✅ 预存成功！', 'success', 'orderStatus');
                await loadBuyerPaymentInfo();
            } catch (e) { showStatus('预存失败：' + e.message, 'error', 'orderStatus'); }
        });
    } catch (e) { container.innerHTML = '<p>加载失败</p>'; }
}

// ==================== Group Leader ====================
// 加载 pending 订单列表供团长勾选
async function loadPendingOrdersList() {
    const container = document.getElementById('pendingOrdersList');
    if (!container) return;
    try {
        const resp = await fetch('/api/orders?status=pending');
        const pending = await resp.json();
        if (pending.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:10px;">暂无待汇总订单</p>';
            return;
        }
        container.innerHTML = pending.map(o => {
            const priceEth = (Number(BigInt(o.totalAmount)) / 1e18).toFixed(4);
            const timeStr = new Date(o.timestamp).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
            return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:6px;margin-bottom:4px;cursor:pointer;">
                <input type="checkbox" class="pending-order-cb" value="${o.id}" checked style="width:16px;height:16px;accent-color:#2ee6d6;">
                <div style="flex:1;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-weight:500;">${o.productName || '商品#' + o.productId}</span>
                        <span style="color:var(--text-muted);margin-left:8px;">×${o.quantity}</span>
                    </div>
                    <div style="text-align:right;font-size:0.82em;">
                        <div>${priceEth} ETH</div>
                        <div style="color:var(--text-muted);">${addrName(o.buyerAddress)} · ${timeStr}</div>
                    </div>
                </div>
            </label>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);">加载失败</p>';
    }
}

// 汇总选中的订单（直接在全部订单列表中一键打勾勾选！）
async function batchSubmitSelected() {
    const checkboxes = document.querySelectorAll('.pending-order-cb:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    if (selectedIds.length === 0) {
        showStatus('请至少勾选 1 笔订单', 'warning', 'groupStatus'); return;
    }

    try {
        // 获取选中订单的详细信息
        const resp = await fetch('/api/orders?status=pending');
        const allPending = await resp.json();
        const pendingOrders = allPending.filter(o => selectedIds.includes(o.id));

        if (pendingOrders.length === 0) {
            showStatus('选中的订单已不存在', 'error', 'groupStatus'); return;
        }

        const buyers = pendingOrders.map(o => o.buyerAddress);
        const productIds = pendingOrders.map(o => o.productId);
        const quantities = pendingOrders.map(o => o.quantity);

        showStatus(`正在汇总上链（${pendingOrders.length} 笔订单，1 次确认即可）...`, 'warning', 'groupStatus');
        const tx = await contracts.orderStorage.batchCreateAndGroup(buyers, productIds, quantities);
        await tx.wait();

        const startOrderId = toNumberSafe(await contracts.orderStorage.nextOrderId()) - pendingOrders.length;
        const endGroupId = toNumberSafe(await contracts.orderStorage.nextGroupId());

        // 更新链下订单状态
        await fetch('/api/orders/mark-submitted', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderIds: pendingOrders.map(o => o.id),
                onChainStartId: startOrderId,
            })
        });

        // 按商家统计展示
        const sellerGroups = {};
        pendingOrders.forEach((o, i) => {
            const seller = o.sellerAddress.toLowerCase();
            if (!sellerGroups[seller]) sellerGroups[seller] = [];
            sellerGroups[seller].push(startOrderId + i);
        });
        const sellerList = Object.keys(sellerGroups);
        const startGroupId = endGroupId - sellerList.length;
        const summary = sellerList.map((s, i) =>
            `批次#${startGroupId + i}(${addrName(s)}: ${sellerGroups[s].length}笔)`
        ).join('、');

        await loadOrders();
        showStatus(`✅ 汇总完成！${pendingOrders.length} 笔订单 → ${sellerList.length} 组：${summary}，正在跳转到多方对账...`, 'success', 'groupStatus');
        await new Promise(r => setTimeout(r, 800));
        const reconciliationTabBtn = document.querySelector('.tab[data-tab="reconciliation"]');
        if (reconciliationTabBtn) {
            reconciliationTabBtn.click();
            // 切换完成后小延时，确保对账页元素已渲染
            await new Promise(r => setTimeout(r, 80));
        } else {
            await loadReconciliationBatches();
        }
        // 直接为新创建的批次发起对账并刷新为“等待商家提交”
        await autoStartReconciliationForNewGroups(startGroupId, sellerList.length);
    } catch (e) { showStatus('汇总失败：' + e.message, 'error', 'groupStatus'); }
}
window.batchSubmitSelected = batchSubmitSelected;

// 汇总完成后：为新创建的批次自动发起对账并提交团长账单，随后刷新为“等待商家提交”
async function autoStartReconciliationForNewGroups(startGroupId, count) {
    try {
        for (let i = 0; i < count; i++) {
            const gid = startGroupId + i;
            const [groupId, leader, orderIds, , , finalized] = await contracts.orderStorage.getGroup(gid);
            if (Number(groupId) !== gid) continue;
            if (!finalized || orderIds.length === 0) continue;
            if (!userAddress || leader.toLowerCase() !== userAddress.toLowerCase()) continue;

            // 跳过已存在的对账批次（避免与服务端自动任务并发重复创建）
            const total = toNumberSafe(await contracts.reconciliation.nextBatchId());
            let exists = false;
            for (let b = 0; b < total; b++) {
                const br = await contracts.reconciliation.getBatch(b);
                if (toNumberSafe(br.groupId) === gid) { exists = true; break; }
            }
            if (exists) continue;

            const { orderIds: billOrderIds, amounts } = await getGroupBillData(gid);
            if (billOrderIds.length === 0) continue;

            const tx = await contracts.reconciliation.startReconciliationWithLeaderBill(gid, billOrderIds, amounts, { gasLimit: 3_000_000 });
            await tx.wait();
        }
        await loadReconciliationBatches();
        showStatus('✅ 已自动发起对账并提交团长账单，等待商家提交。', 'success', 'reconciliationStatus');
    } catch (e) {
        // 并发或索引延迟下，刷新列表兜底
        await loadReconciliationBatches();
        showStatus('⚠️ 已尝试自动发起对账：' + e.message, 'warning', 'reconciliationStatus');
    }
}

async function createGroup() {
    try {
        const tx = await contracts.orderStorage.createGroup();
        showStatus('创建批次中...', 'warning', 'groupStatus');
        await tx.wait();
        showStatus('团购批次创建成功！', 'success', 'groupStatus');
        await loadGroups();
    } catch (e) { showStatus('创建失败：' + e.message, 'error', 'groupStatus'); }
}

async function addOrdersToGroup() {
    try {
        const groupId = parseInt(document.getElementById('groupId').value);
        const orderIds = document.getElementById('groupOrderIds').value.split(',').map(s => parseInt(s.trim()));
        if (isNaN(groupId) || orderIds.some(isNaN)) {
            showStatus('请输入有效的ID', 'error', 'groupStatus'); return;
        }
        const tx = await contracts.orderStorage.addOrdersToGroup(groupId, orderIds);
        showStatus('添加中...', 'warning', 'groupStatus');
        await tx.wait();
        showStatus('订单已加入批次！', 'success', 'groupStatus');
        await loadGroups();
    } catch (e) { showStatus('添加失败：' + e.message, 'error', 'groupStatus'); }
}

async function finalizeGroup() {
    try {
        const groupId = parseInt(document.getElementById('finalizeGroupId').value);
        const tx = await contracts.orderStorage.finalizeGroup(groupId);
        showStatus('确认中...', 'warning', 'groupStatus');
        await tx.wait();
        showStatus('批次已确认汇总！', 'success', 'groupStatus');
        await loadGroups();
    } catch (e) { showStatus('确认失败：' + e.message, 'error', 'groupStatus'); }
}

// ==================== 团长汇总策略 + 就绪检测 ====================
let readinessTimer = null;
let autoSubmitting = false; // 防止重复自动提交
let autoSubmitEnabled = true; // 自动汇总开关（默认开启）

async function loadLeaderConfig() {
    try {
        const resp = await fetch('/api/leader-config');
        const cfg = await resp.json();
        const h = document.getElementById('cfgCutoffHours');
        const c = document.getElementById('cfgThresholdCount');
        const a = document.getElementById('cfgThresholdAmount');
        if (h) h.value = cfg.cutoffHours;
        if (c) c.value = cfg.thresholdCount;
        if (a) a.value = cfg.thresholdAmountEth;
    } catch (e) { console.error('加载策略失败', e); }
}

async function saveLeaderConfig() {
    const cutoffHours = parseFloat(document.getElementById('cfgCutoffHours').value);
    const thresholdCount = parseInt(document.getElementById('cfgThresholdCount').value, 10);
    const thresholdAmountEth = parseFloat(document.getElementById('cfgThresholdAmount').value);
    if (!isFinite(cutoffHours) || cutoffHours <= 0) return showStatus('截单小时必须 > 0', 'error', 'groupStatus');
    if (!Number.isInteger(thresholdCount) || thresholdCount < 1) return showStatus('订单数阈值必须 ≥ 1', 'error', 'groupStatus');
    if (!isFinite(thresholdAmountEth) || thresholdAmountEth <= 0) return showStatus('总额阈值必须 > 0', 'error', 'groupStatus');
    try {
        const resp = await fetch('/api/leader-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cutoffHours, thresholdCount, thresholdAmountEth })
        });
        const result = await resp.json();
        if (result.success) {
            showStatus('策略已保存', 'success', 'groupStatus');
            await refreshReadiness();
        } else {
            showStatus('保存失败：' + result.error, 'error', 'groupStatus');
        }
    } catch (e) { showStatus('保存失败：' + e.message, 'error', 'groupStatus'); }
}
window.saveLeaderConfig = saveLeaderConfig;

// 为团长动态绑定在 orders 页面上的策略按钮和开关事件
function bindGroupLeaderEvents() {
    const saveBtn = document.getElementById('saveLeaderConfig');
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener('click', saveLeaderConfig);
        saveBtn.dataset.bound = '1';
    }
    
    // 自动汇总开关
    const autoToggle = document.getElementById('autoSubmitToggle');
    if (autoToggle && !autoToggle.dataset.bound) {
        // 初始化读取服务端开关状态
        fetch('/api/auto-submit/status').then(r => r.json()).then(d => {
            autoToggle.checked = d.enabled;
            autoSubmitEnabled = d.enabled;
            const label = document.getElementById('autoSubmitLabel');
            if (label) {
                label.textContent = d.enabled ? '自动汇总：开' : '自动汇总：关';
                label.style.color = d.enabled ? '#2ee6d6' : 'var(--text-muted)';
            }
        });
        autoToggle.addEventListener('change', async () => {
            const enabled = autoToggle.checked;
            const resp = await fetch('/api/auto-submit/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            const result = await resp.json();
            autoSubmitEnabled = result.enabled;
            const label = document.getElementById('autoSubmitLabel');
            if (label) {
                label.textContent = result.enabled ? '自动汇总：开' : '自动汇总：关';
                label.style.color = result.enabled ? '#2ee6d6' : 'var(--text-muted)';
            }
            showStatus(result.enabled ? '服务端自动汇总已开启' : '服务端自动汇总已关闭', 'success', 'groupStatus');
        });
        autoToggle.dataset.bound = '1';
    }
}

function formatRemain(ms) {
    if (ms <= 0) return '0';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 1) return `${h}h${m}m`;
    return `${m}m`;
}

async function refreshReadiness() {
    const container = document.getElementById('readinessList');
    if (!container) return;
    try {
        const resp = await fetch('/api/batch-readiness');
        const data = await resp.json();
        if (!data.groups || data.groups.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:14px;text-align:center;">暂无待汇总订单</p>';
            return;
        }
        container.innerHTML = data.groups.map(g => {
            const totalEth = (Number(BigInt(g.totalAmount)) / 1e18).toFixed(4);
            const stateChip = g.ready
                ? '<span style="background:rgba(46,230,214,0.18);color:#2ee6d6;padding:3px 10px;border-radius:12px;font-size:0.78em;font-weight:600;">● 就绪</span>'
                : `<span style="background:rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 10px;border-radius:12px;font-size:0.78em;">等待 · 距截单 ${formatRemain(g.nextCutoffMs)}</span>`;
            const reasons = g.ready
                ? `<div style="font-size:0.78em;color:#2ee6d6;margin-top:4px;">触发条件：${g.reasons.join('；')}</div>`
                : '';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(0,0,0,0.18);border-radius:8px;margin-bottom:8px;border-left:3px solid ${g.ready ? '#2ee6d6' : 'rgba(255,255,255,0.1)'};">
                <div style="flex:1;">
                    <div style="font-weight:500;">${addrName(g.seller)}</div>
                    <div style="font-size:0.82em;color:var(--text-muted);margin-top:2px;">
                        ${g.count} 单 · 合计 ${totalEth} ETH · 最早等待 ${g.ageHours}h
                    </div>
                    ${reasons}
                </div>
                ${stateChip}
            </div>`;
        }).join('');
        // 服务端守护进程负责自动上链，前端仅展示状态
        const hasReady = data.groups.some(g => g.ready);
        if (hasReady && autoSubmitEnabled) {
            showStatus('⚡ 条件已就绪，服务端将自动完成上链（无需手动操作）', 'success', 'groupStatus');
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);">获取就绪状态失败：' + e.message + '</p>';
    }
}

function startReadinessPolling() {
    stopReadinessPolling();
    refreshReadiness();
    readinessTimer = setInterval(refreshReadiness, 10000);
}
function stopReadinessPolling() {
    if (readinessTimer) { clearInterval(readinessTimer); readinessTimer = null; }
}

async function loadGroups() {
    // 进团长页时同时加载策略配置 + 启动就绪轮询
    await loadLeaderConfig();
    startReadinessPolling();
    const saveBtn = document.getElementById('saveLeaderConfig');
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener('click', saveLeaderConfig);
        saveBtn.dataset.bound = '1';
    }
    // 自动汇总开关（控制服务端守护进程）
    const autoToggle = document.getElementById('autoSubmitToggle');
    if (autoToggle && !autoToggle.dataset.bound) {
        // 初始化状态
        fetch('/api/auto-submit/status').then(r => r.json()).then(d => {
            autoToggle.checked = d.enabled;
            autoSubmitEnabled = d.enabled;
            const label = document.getElementById('autoSubmitLabel');
            if (label) {
                label.textContent = d.enabled ? '自动汇总：开' : '自动汇总：关';
                label.style.color = d.enabled ? '#2ee6d6' : 'var(--text-muted)';
            }
        });
        autoToggle.addEventListener('change', async () => {
            const enabled = autoToggle.checked;
            const resp = await fetch('/api/auto-submit/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            const result = await resp.json();
            autoSubmitEnabled = result.enabled;
            const label = document.getElementById('autoSubmitLabel');
            if (label) {
                label.textContent = result.enabled ? '自动汇总：开' : '自动汇总：关';
                label.style.color = result.enabled ? '#2ee6d6' : 'var(--text-muted)';
            }
            showStatus(result.enabled ? '服务端自动汇总已开启' : '服务端自动汇总已关闭', 'success', 'groupStatus');
        });
        autoToggle.dataset.bound = '1';
    }
    // 手动汇总按钮绑定
    const batchSelBtn = document.getElementById('batchSubmitSelected');
    if (batchSelBtn && !batchSelBtn.dataset.bound) {
        batchSelBtn.addEventListener('click', batchSubmitSelected);
        batchSelBtn.dataset.bound = '1';
    }
    const selectAllBtn = document.getElementById('selectAllOrders');
    if (selectAllBtn && !selectAllBtn.dataset.bound) {
        selectAllBtn.addEventListener('click', () => {
            const cbs = document.querySelectorAll('.pending-order-cb');
            const allChecked = Array.from(cbs).every(cb => cb.checked);
            cbs.forEach(cb => cb.checked = !allChecked);
            selectAllBtn.textContent = allChecked ? '全选' : '取消全选';
        });
        selectAllBtn.dataset.bound = '1';
    }
    // 加载 pending 订单列表
    await loadPendingOrdersList();

    const list = document.getElementById('groupsList');
    try {
        const total = toNumberSafe(await contracts.orderStorage.nextGroupId());
        if (total === 0) { list.innerHTML = '<p>暂无团购批次</p>'; return; }

        // 预加载已有对账批次的 groupId 集合
        const nextReconId = toNumberSafe(await contracts.reconciliation.nextBatchId());
        const reconciledGroupIds = new Set();
        for (let r = 0; r < nextReconId; r++) {
            const rb = await contracts.reconciliation.getBatch(r);
            reconciledGroupIds.add(toNumberSafe(rb.groupId));
        }

        let html = '';
        for (let i = total - 1; i >= 0; i--) {
            const [groupId, leader, orderIds, totalAmount, createdAt, finalized] = await contracts.orderStorage.getGroup(i);
            const alreadyReconciled = reconciledGroupIds.has(i);
            const canStartRecon = (currentUserRole === 'leader' || currentUserRole === 'admin')
                && finalized && !alreadyReconciled && orderIds.length > 0;
            const statusTag = !finalized
                ? '⏳ 进行中'
                : (alreadyReconciled ? '📑 已发起对账' : '✅ 已汇总，待对账');
            const actionBtn = canStartRecon
                ? `<button class="btn btn-success" style="margin-top:10px;padding:6px 16px;" onclick="quickStartReconciliation(${i})">一键发起对账</button>`
                : '';
            html += `<div class="batch-item">
                <h4>团购批次 #${i} ${statusTag}</h4>
                <div class="batch-details">
                    <div class="detail-item"><span class="detail-label">团长:</span><span>${addrName(leader)}</span></div>
                    <div class="detail-item"><span class="detail-label">订单数:</span><span>${orderIds.length}</span></div>
                    <div class="detail-item"><span class="detail-label">总金额:</span><span>${formatEtherSafe(totalAmount)} ETH</span></div>
                    <div class="detail-item"><span class="detail-label">含订单:</span><span>${orderIds.map(id => '#' + toNumberSafe(id)).join('、') || '无'}</span></div>
                </div>
                ${actionBtn}
            </div>`;
        }
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

// 团长在团购批次卡片上一键发起对账
async function quickStartReconciliation(groupId) {
    document.getElementById('reconGroupId').value = groupId;
    await startReconciliation();
    await loadReconciliationBatches();
}
window.quickStartReconciliation = quickStartReconciliation;

// ==================== Reconciliation ====================
// 从链上读取批次的订单数据，自动生成账单
async function getGroupBillData(groupId) {
    const orders = await contracts.orderStorage.getGroupOrders(groupId);
    const orderIds = orders.map(o => toNumberSafe(o.orderId));
    const amounts = orders.map(o => o.amount);  // 保留 BigInt
    return { orderIds, amounts, orders };
}

// 团长：一键发起对账并自动提交账单
async function startReconciliation() {
    try {
        const groupId = parseInt(document.getElementById('reconGroupId').value);
        if (isNaN(groupId)) { showStatus('请输入批次ID', 'error', 'reconciliationStatus'); return; }

        // 1. 读取该批次的订单数据
        showStatus('[1/2] 读取批次订单数据...', 'warning', 'reconciliationStatus');
        const { orderIds, amounts } = await getGroupBillData(groupId);
        if (orderIds.length === 0) { showStatus('该批次没有订单', 'error', 'reconciliationStatus'); return; }

        // 2. 一笔交易完成：发起对账 + 提交团长账单
        showStatus(`[2/2] 一键发起对账并提交团长账单（${orderIds.length} 笔订单）...`, 'warning', 'reconciliationStatus');
        const tx1 = await contracts.reconciliation.startReconciliationWithLeaderBill(groupId, orderIds, amounts);
        await tx1.wait();
        const batchId = toNumberSafe(await contracts.reconciliation.nextBatchId()) - 1;

        showStatus(`✅ 对账批次 #${batchId} 已创建，团长账单已自动提交！等待商家确认。`, 'success', 'reconciliationStatus');
        await loadReconciliationBatches();
    } catch (e) { showStatus('发起失败：' + e.message, 'error', 'reconciliationStatus'); }
}

// 商家：加载待确认订单（显示表格让商家确认/修改金额）
async function loadSellerBillPreview() {
    try {
        const preview = document.getElementById('sellerBillPreview');
        preview.innerHTML = '<p style="color:var(--text-muted);">正在加载订单...</p>';
        const batchId = parseInt(document.getElementById('sellerBillBatchId').value);
        if (isNaN(batchId)) { showStatus('请输入对账批次ID', 'error', 'reconciliationStatus'); return; }

        // 校验批次存在
        const nextBatchId = toNumberSafe(await contracts.reconciliation.nextBatchId());
        if (batchId < 0 || batchId >= nextBatchId) {
            preview.innerHTML = `<p style="color:#ff6b6b;">对账批次 #${batchId} 不存在。当前已创建 ${nextBatchId} 个批次（ID 范围 0 ~ ${nextBatchId - 1}）。</p>`;
            showStatus(`对账批次 #${batchId} 不存在`, 'error', 'reconciliationStatus');
            return;
        }

        const reconBatch = await contracts.reconciliation.getBatch(batchId);
        const groupId = toNumberSafe(reconBatch.groupId);
        if (reconBatch.completed) {
            preview.innerHTML = `<p style="color:#ffa94d;">对账批次 #${batchId} 已完成，无需再次提交。</p>`;
            showStatus(`对账批次 #${batchId} 已完成`, 'warning', 'reconciliationStatus');
            return;
        }

        showStatus('读取订单数据...', 'warning', 'reconciliationStatus');
        const allOrders = await contracts.orderStorage.getGroupOrders(groupId);
        const groupSellers = [...new Set(allOrders.map(o => o.seller.toLowerCase()))];
        const myOrders = allOrders.filter(o => o.seller.toLowerCase() === userAddress.toLowerCase());
        if (myOrders.length === 0) {
            const sellerNames = groupSellers.map(s => addrName(s)).join('、');
            preview.innerHTML = `<p style="color:#ff6b6b;">当前账号 ${addrName(userAddress)} 不是该批次商家。该批次商家是：${sellerNames}</p>`;
            showStatus(`该批次属于 ${sellerNames}，请切换到对应商家账号。`, 'error', 'reconciliationStatus');
            return;
        }

        // 显示订单表格，让商家确认或修改金额
        const productCache = {};
        async function getProductInfo(productId) {
            if (!productCache[productId]) {
                productCache[productId] = await contracts.productRegistry.getProduct(productId);
            }
            return productCache[productId];
        }

        let tableHtml = `<table class="bill-table" style="width:100%;border-collapse:collapse;margin:12px 0;">
            <thead><tr style="border-bottom:1px solid var(--border-color);">
                <th style="text-align:left;padding:8px;">订单ID</th>
                <th style="text-align:left;padding:8px;">买家</th>
                <th style="text-align:left;padding:8px;">商品</th>
                <th style="text-align:left;padding:8px;">数量</th>
                <th style="text-align:left;padding:8px;">单价</th>
                <th style="text-align:left;padding:8px;">团长记录金额</th>
                <th style="text-align:left;padding:8px;">商家确认金额(ETH)</th>
            </tr></thead><tbody>`;
        for (const o of myOrders) {
            const orderId = toNumberSafe(o.orderId);
            const productId = toNumberSafe(o.productId);
            const product = await getProductInfo(productId);
            const amountEth = formatEtherSafe(o.amount);
            const unitPriceEth = formatEtherSafe(product.price);
            tableHtml += `<tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:8px;">#${orderId}</td>
                <td style="padding:8px;">${addrName(o.buyer)}</td>
                <td style="padding:8px;">${product.name} <span style="color:var(--text-muted);">#${productId}</span></td>
                <td style="padding:8px;">${toNumberSafe(o.quantity)}</td>
                <td style="padding:8px;">${unitPriceEth} ETH</td>
                <td style="padding:8px;">${amountEth} ETH</td>
                <td style="padding:8px;"><input type="text" class="seller-bill-amount" data-order-id="${orderId}" value="${amountEth}" style="width:100px;padding:4px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;"></td>
            </tr>`;
        }
        tableHtml += `</tbody></table>
            <p style="font-size:0.8em;color:var(--text-muted);line-height:1.6;">
                如果账单无误，保持金额不变并提交；如果发现数量、价格或实收金额有问题，修改“商家确认金额”后提交，系统会自动标记为差异并进入争议处理。
            </p>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <button id="confirmSellerBill" class="btn btn-success">确认无误并提交</button>
                <span style="font-size:0.82em;color:#f0ad4e;align-self:center;">有问题时请先修改金额，再点击提交</span>
            </div>`;
        
        preview.innerHTML = tableHtml;
        preview.dataset.batchId = batchId;

        // 绑定确认按钮
        document.getElementById('confirmSellerBill').addEventListener('click', submitSellerBillConfirm);
        showStatus('请核对订单金额后点击"确认提交"', 'success', 'reconciliationStatus');
    } catch (e) {
        console.error('加载商家账单失败:', e);
        document.getElementById('sellerBillPreview').innerHTML = `<p style="color:#ff6b6b;">加载失败：${e.message}</p>`;
        showStatus('加载失败：' + e.message, 'error', 'reconciliationStatus');
    }
}

// 商家确认并提交账单
async function submitSellerBillConfirm() {
    try {
        const batchId = parseInt(document.getElementById('sellerBillPreview').dataset.batchId);
        const rows = document.querySelectorAll('.seller-bill-amount');
        const orderIds = [];
        const amounts = [];
        
        for (const input of rows) {
            orderIds.push(parseInt(input.dataset.orderId));
            amounts.push(parseEtherSafe(input.value.trim()));
        }

        showStatus(`提交商家账单（${orderIds.length} 笔）...`, 'warning', 'reconciliationStatus');
        const tx = await contracts.reconciliation.submitSellerBill(batchId, orderIds, amounts);
        await tx.wait();

        showStatus(`✅ 商家账单已成功提交！后台已启动全自动流转：正在智能比对对账、计算并向多签钱包发起清算方案提案...`, 'warning', 'reconciliationStatus');
        document.getElementById('sellerBillPreview').innerHTML = '';
        await loadReconciliationBatches();
        await refreshReconciliationRedDot(); // 提交成功后立刻更新红点

        // 等待 3.5 秒让后台将全部交易（对账完成 -> Propose清算 -> 多签钱包创建提案）完全挖出上链
        await new Promise(r => setTimeout(r, 3500));

        // 自动平滑跳转到多签钱包
        showStatus(`✅ 后台已成功自动为您在多签钱包里创建了“清算批准提案”！正在跳转至多签钱包查看...`, 'success', 'reconciliationStatus');
        await new Promise(r => setTimeout(r, 1200));
        const multisigTabBtn = document.querySelector('.tab[data-tab="multisig"]');
        if (multisigTabBtn) multisigTabBtn.click();
    } catch (e) { showStatus('提交失败：' + e.message, 'error', 'reconciliationStatus'); }
}

// 保留手动提交功能（备用）
async function submitLeaderBill() {
    try {
        const batchId = parseInt(document.getElementById('leaderBillBatchId').value);
        const reconBatch = await contracts.reconciliation.getBatch(batchId);
        const groupId = toNumberSafe(reconBatch.groupId);
        const { orderIds, amounts } = await getGroupBillData(groupId);
        const tx = await contracts.reconciliation.submitLeaderBill(batchId, orderIds, amounts);
        showStatus('团长账单提交中...', 'warning', 'reconciliationStatus');
        await tx.wait();
        showStatus('团长账单已提交！', 'success', 'reconciliationStatus');
        await loadReconciliationBatches();
    } catch (e) { showStatus('提交失败：' + e.message, 'error', 'reconciliationStatus'); }
}

async function loadReconciliationBatches() {
    const list = document.getElementById('batchesList');
    try {
        const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';
        const isSeller = currentUserRole === 'seller';

        async function mapLimit(arr, limit, iter) {
            const ret = new Array(arr.length);
            let i = 0, active = 0, done = 0;
            return await new Promise((resolve, reject) => {
                function next() {
                    if (done === arr.length) { resolve(ret); return; }
                    while (active < limit && i < arr.length) {
                        const cur = i++;
                        active++;
                        Promise.resolve(iter(arr[cur], cur))
                            .then(v => { ret[cur] = v; active--; done++; next(); })
                            .catch(reject);
                    }
                }
                next();
            });
        }

        const groupOrdersCache = window.__groupOrdersCache || new Map();
        window.__groupOrdersCache = groupOrdersCache;

        const total = toNumberSafe(await contracts.reconciliation.nextBatchId());

        async function renderPendingReconciliationGroups(existingGroupIds = new Set()) {
            if (!isLeader) return '';
            const groupTotal = toNumberSafe(await contracts.orderStorage.nextGroupId());
            const start = Math.max(0, groupTotal - 20);
            const indices = [];
            for (let g = groupTotal - 1; g >= start; g--) { if (!existingGroupIds.has(g)) indices.push(g); }
            const rows = await mapLimit(indices, 8, async (g) => {
                const [groupId, leader, orderIds, totalAmount, createdAt, finalized] = await contracts.orderStorage.getGroup(g);
                if (!finalized || orderIds.length === 0) return '';
                return `<div class="batch-item" style="border-color:rgba(46,230,214,0.25);">
                    <h4>团购批次 #${g} ✅ 已汇总，待发起对账</h4>
                    <div class="batch-details">
                        <div class="detail-item"><span class="detail-label">团长:</span><span>${addrName(leader)}</span></div>
                        <div class="detail-item"><span class="detail-label">订单数:</span><span>${orderIds.length}</span></div>
                        <div class="detail-item"><span class="detail-label">总金额:</span><span>${formatEtherSafe(totalAmount)} ETH</span></div>
                        <div class="detail-item"><span class="detail-label">含订单:</span><span>${orderIds.map(id => '#' + toNumberSafe(id)).join('、')}</span></div>
                    </div>
                    <button class="btn btn-success" style="margin-top:10px;padding:6px 16px;" onclick="quickStartReconciliation(${g})">一键发起对账</button>
                </div>`;
            });
            return rows.filter(Boolean).join('');
        }

        if (total === 0) {
            const pendingGroupsHtml = await renderPendingReconciliationGroups();
            list.innerHTML = pendingGroupsHtml || '<p>暂无对账批次</p>';
            return;
        }

        const nextSettleId = toNumberSafe(await contracts.settlement.nextBatchId());
        const settleIndices = Array.from({ length: nextSettleId }, (_, i) => i);
        const settleBatches = await mapLimit(settleIndices, 8, async (s) => await contracts.settlement.getBatch(s));
        const proposedReconIds = new Set();
        settleBatches.forEach((sb) => { if (sb) proposedReconIds.add(toNumberSafe(sb.reconciliationBatchId)); });

        const ids = Array.from({ length: total }, (_, i) => i).reverse();
        const headCount = Math.min(total, 10);
        const headIds = ids.slice(0, headCount);
        const tailIds = ids.slice(headCount);
        const batchesHead = await mapLimit(headIds, 8, async (i) => await contracts.reconciliation.getBatch(i));

        const reconciledGroupIds = new Set();
        let htmlHead = '';
        for (let idx = 0; idx < batchesHead.length; idx++) {
            const i = headIds[idx];
            const b = batchesHead[idx];
            if (!b) continue;
            const status = b.completed ? '✅ 已完成' : (b.leaderSubmitted && b.sellerSubmitted) ? '⏳ 比对中' : '📝 等待商家提交';
            const groupId = toNumberSafe(b.groupId);
            reconciledGroupIds.add(groupId);
            const alreadyProposed = proposedReconIds.has(i);

            let leaderAction = '';
            if (isLeader && b.completed && !alreadyProposed && toNumberSafe(b.mismatchedCount) === 0) {
                leaderAction = `<button class="btn btn-success" style="margin-top:10px;padding:6px 16px;" onclick="quickProposeSettlement(${i})">提出清算方案</button>`;
            } else if (alreadyProposed) {
                leaderAction = `<p style=\"margin-top:10px;font-size:0.85em;color:#2ee6d6;\">⚡ 系统已自动生成并提出净额清算方案。请到“多签钱包/净额清算”页面进行审批。</p>`;
            }

            htmlHead += `<div class=\"batch-item\" id=\"recon-card-${i}\">\n                <h4>对账批次 #${i} ${status}</h4>\n                <div class=\"batch-details\">\n                    <div class=\"detail-item\"><span class=\"detail-label\">团购批次:</span><span>#${groupId}</span></div>\n                    <div class=\"detail-item\"><span class=\"detail-label\">团长账单:</span><span>${b.leaderSubmitted ? '✅ 已提交' : '<span style=\\\"color:#f0ad4e;\\\">⏳ 待提交</span>'}</span></div>\n                    <div class=\"detail-item\"><span class=\"detail-label\">商家账单:</span><span>${b.sellerSubmitted ? '✅ 已提交' : '<span style=\\\"color:#f0ad4e;\\\">⏳ 待提交</span>'}</span></div>\n                    <div class=\"detail-item\"><span class=\"detail-label\">一致:</span><span>${toNumberSafe(b.matchedCount)} 笔</span></div>\n                    <div class=\"detail-item\"><span class=\"detail-label\">差异:</span><span style=\"color:${toNumberSafe(b.mismatchedCount) > 0 ? '#ff6b6b' : 'inherit'}\">${toNumberSafe(b.mismatchedCount)} 笔</span></div>\n                </div>\n                <div id=\"actionArea-${i}\">${leaderAction}</div>\n                <div class=\"seller-bill-area\" id=\"sellerBillArea-${i}\" style=\"margin-top:10px;\"></div>\n            </div>`;
        }

        const pendingGroupsHtml = await renderPendingReconciliationGroups(reconciledGroupIds);
        list.innerHTML = (pendingGroupsHtml || '') + htmlHead;

        if (isSeller) {
            await mapLimit(headIds, 4, async (i) => {
                const b = batchesHead[headIds.indexOf(i)];
                if (!b || b.sellerSubmitted) return;
                const groupId = toNumberSafe(b.groupId);
                let orders = groupOrdersCache.get(groupId);
                if (!orders) {
                    orders = await contracts.orderStorage.getGroupOrders(groupId);
                    groupOrdersCache.set(groupId, orders);
                }
                const isOurSellerBatch = orders.some(o => o.seller.toLowerCase() === userAddress.toLowerCase());
                if (isOurSellerBatch) {
                    const el = document.getElementById(`actionArea-${i}`);
                    if (el && !b.sellerSubmitted) {
                        el.innerHTML = `<button class=\"btn btn-success\" style=\"margin-top:10px;padding:6px 16px;\" onclick=\"quickLoadSellerBill(${i})\">加载并提交我的账单</button>`;
                    }
                }
            });
        }

        if (ids.length > headCount) {
            const batchesTail = await mapLimit(tailIds, 6, async (i) => await contracts.reconciliation.getBatch(i));
            for (let idx = 0; idx < batchesTail.length; idx++) {
                const i = tailIds[idx];
                const b = batchesTail[idx];
                if (!b) continue;
                const status = b.completed ? '✅ 已完成' : (b.leaderSubmitted && b.sellerSubmitted) ? '⏳ 比对中' : '📝 等待商家提交';
                const groupId = toNumberSafe(b.groupId);
                const alreadyProposed = proposedReconIds.has(i);
                let leaderAction = '';
                if (isLeader && b.completed && !alreadyProposed && toNumberSafe(b.mismatchedCount) === 0) {
                    leaderAction = `<button class=\"btn btn-success\" style=\"margin-top:10px;padding:6px 16px;\" onclick=\"quickProposeSettlement(${i})\">提出清算方案</button>`;
                } else if (alreadyProposed) {
                    leaderAction = `<p style=\"margin-top:10px;font-size:0.85em;color:#2ee6d6;\">⚡ 系统已自动生成并提出净额清算方案。请到“多签钱包/净额清算”页面进行审批。</p>`;
                }
                const cardHtml = `<div class=\"batch-item\" id=\"recon-card-${i}\">\n                    <h4>对账批次 #${i} ${status}</h4>\n                    <div class=\"batch-details\">\n                        <div class=\"detail-item\"><span class=\"detail-label\">团购批次:</span><span>#${groupId}</span></div>\n                        <div class=\"detail-item\"><span class=\"detail-label\">团长账单:</span><span>${b.leaderSubmitted ? '✅ 已提交' : '<span style=\\\"color:#f0ad4e;\\\">⏳ 待提交</span>'}</span></div>\n                        <div class=\"detail-item\"><span class=\"detail-label\">商家账单:</span><span>${b.sellerSubmitted ? '✅ 已提交' : '<span style=\\\"color:#f0ad4e;\\\">⏳ 待提交</span>'}</span></div>\n                        <div class=\"detail-item\"><span class=\"detail-label\">一致:</span><span>${toNumberSafe(b.matchedCount)} 笔</span></div>\n                        <div class=\"detail-item\"><span class=\"detail-label\">差异:</span><span style=\"color:${toNumberSafe(b.mismatchedCount) > 0 ? '#ff6b6b' : 'inherit'}\">${toNumberSafe(b.mismatchedCount)} 笔</span></div>\n                    </div>\n                    <div id=\"actionArea-${i}\">${leaderAction}</div>\n                    <div class=\"seller-bill-area\" id=\"sellerBillArea-${i}\" style=\"margin-top:10px;\"></div>\n                </div>`;
                list.insertAdjacentHTML('beforeend', cardHtml);
            }
            if (isSeller) {
                await mapLimit(tailIds, 4, async (i) => {
                    const b = batchesTail[tailIds.indexOf(i)];
                    if (!b || b.sellerSubmitted) return;
                    const groupId = toNumberSafe(b.groupId);
                    let orders = groupOrdersCache.get(groupId);
                    if (!orders) {
                        orders = await contracts.orderStorage.getGroupOrders(groupId);
                        groupOrdersCache.set(groupId, orders);
                    }
                    const isOurSellerBatch = orders.some(o => o.seller.toLowerCase() === userAddress.toLowerCase());
                    if (isOurSellerBatch) {
                        const el = document.getElementById(`actionArea-${i}`);
                        if (el && !b.sellerSubmitted) {
                            el.innerHTML = `<button class=\"btn btn-success\" style=\"margin-top:10px;padding:6px 16px;\" onclick=\"quickLoadSellerBill(${i})\">加载并提交我的账单</button>`;
                        }
                    }
                });
            }
        }
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

// 商家在对账批次卡片内加载账单
async function quickLoadSellerBill(batchId) {
    document.getElementById('sellerBillBatchId').value = batchId;
    const tmpPreview = document.getElementById('sellerBillPreview');
    const targetArea = document.getElementById(`sellerBillArea-${batchId}`);
    // 调用原逻辑，接管渲染到卡片内部
    tmpPreview.style.display = '';
    await loadSellerBillPreview();
    if (targetArea) {
        targetArea.innerHTML = tmpPreview.innerHTML;
        // 按钮重新绑定
        const confirmBtn = targetArea.querySelector('#confirmSellerBill');
        if (confirmBtn) confirmBtn.addEventListener('click', submitSellerBillConfirm);
        targetArea.dataset.batchId = batchId;
        tmpPreview.dataset.batchId = batchId;
    }
    tmpPreview.style.display = 'none';
}
window.quickLoadSellerBill = quickLoadSellerBill;

// 团长在对账批次卡片内提出清算
async function quickProposeSettlement(reconBatchId) {
    document.getElementById('proposeReconBatchId').value = reconBatchId;
    await proposeSettlement();
    await loadReconciliationBatches();
}
window.quickProposeSettlement = quickProposeSettlement;

// ==================== Settlement ====================
async function proposeSettlement() {
    try {
        const reconBatchId = parseInt(document.getElementById('proposeReconBatchId').value);
        if (isNaN(reconBatchId)) { showStatus('请输入对账批次ID', 'error', 'settlementStatus'); return; }
        const nextReconId = toNumberSafe(await contracts.reconciliation.nextBatchId());
        if (reconBatchId < 0 || reconBatchId >= nextReconId) {
            showStatus(`对账批次 #${reconBatchId} 不存在（当前已创建 ${nextReconId} 个、ID 0~${nextReconId - 1}）`, 'error', 'settlementStatus');
            return;
        }
        showStatus('正在检查对账批次状态...', 'warning', 'settlementStatus');
        const reconBatch = await contracts.reconciliation.getBatch(reconBatchId);
        if (!reconBatch.completed) {
            showStatus('该对账批次尚未完成，需团长账单和商家账单都提交后才能清算。', 'error', 'settlementStatus');
            return;
        }
        showStatus('请在 MetaMask 中确认提出清算交易...', 'warning', 'settlementStatus');
        const tx = await contracts.settlement.proposeSettlement(reconBatchId);
        showStatus('提出清算方案中...', 'warning', 'settlementStatus');
        await tx.wait();
        const batchId = toNumberSafe(await contracts.settlement.nextBatchId()) - 1;
        document.getElementById('approveSettlementId').value = batchId;
        showStatus(`清算批次 #${batchId} 已提出，继续提交多签审批...`, 'warning', 'settlementStatus');
        await submitApprovalToMultisig(batchId);
        await loadSettlementBatches();
    } catch (e) { showStatus('提出失败：' + e.message, 'error', 'settlementStatus'); }
}

async function submitApprovalToMultisig(batchIdOverride = null) {
    try {
        const batchId = batchIdOverride !== null ? batchIdOverride : parseInt(document.getElementById('approveSettlementId').value);
        if (isNaN(batchId)) { showStatus('请输入清算批次ID', 'error', 'settlementStatus'); return; }
        const nextSettleId = toNumberSafe(await contracts.settlement.nextBatchId());
        if (batchId < 0 || batchId >= nextSettleId) {
            showStatus(`清算批次 #${batchId} 不存在（当前已创建 ${nextSettleId} 个、ID 0~${nextSettleId - 1}）`, 'error', 'settlementStatus');
            return;
        }
        showStatus('正在检查清算批次状态...', 'warning', 'settlementStatus');
        const batch = await contracts.settlement.getBatch(batchId);
        const status = toNumberSafe(batch.status);
        if (status !== 0) {
            showStatus('该清算批次不是“待审批”状态，不能重复提交多签审批。', 'error', 'settlementStatus');
            return;
        }
        const reconBatch = await contracts.reconciliation.getBatch(toNumberSafe(batch.reconciliationBatchId));
        const groupOrders = await contracts.orderStorage.getGroupOrders(toNumberSafe(reconBatch.groupId));
        const allowedConfirmers = [...new Set([
            ROLE_ACCOUNTS.admin.toLowerCase(),
            ...groupOrders.map(o => o.seller.toLowerCase()),
            ...groupOrders.map(o => o.buyer.toLowerCase())
        ])];
        // 编码 approveSettlement(uint256) 调用数据，兼容 ethers v5/v6
        let data;
        if (isEthersV6) {
            const iface = new ethers.Interface(["function approveSettlement(uint256)"]);
            data = iface.encodeFunctionData("approveSettlement", [batchId]);
        } else {
            const iface = new ethers.utils.Interface(["function approveSettlement(uint256)"]);
            data = iface.encodeFunctionData("approveSettlement", [batchId]);
        }
        console.log("approveSettlement calldata:", data);
        const settlementAddr = CONTRACT_ADDRESSES.settlement;
        // 提交到多签钱包，将 data 转为 bytes 数组确保正确编码
        const dataBytes = isEthersV6 ? ethers.getBytes(data) : ethers.utils.arrayify(data);
        showStatus('请在 MetaMask 中确认提交多签审批交易...', 'warning', 'settlementStatus');
        const tx = await contracts.multisig.submitRestrictedTransaction(settlementAddr, 0, dataBytes, allowedConfirmers);
        showStatus('提交多签审批中...', 'warning', 'settlementStatus');
        const receipt = await tx.wait();
        showStatus(`多签审批交易已提交！请到「多签钱包」tab 确认和执行。`, 'success', 'settlementStatus');
        await refreshMultisigRedDot();
    } catch (e) { showStatus('提交失败：' + e.message, 'error', 'settlementStatus'); }
}

async function executeSettlement() {
    try {
        const batchId = parseInt(document.getElementById('executeSettlementId').value);
        if (isNaN(batchId)) { showStatus('请输入清算批次ID', 'error', 'settlementStatus'); return; }
        const nextSettleId = toNumberSafe(await contracts.settlement.nextBatchId());
        if (batchId < 0 || batchId >= nextSettleId) {
            showStatus(`清算批次 #${batchId} 不存在（当前已创建 ${nextSettleId} 个、ID 0~${nextSettleId - 1}）`, 'error', 'settlementStatus');
            return;
        }
        
        // 检查 escrow 余额是否足够
        const batch = await contracts.settlement.getBatch(batchId);
        const totalPayout = batch.totalPayout;
        const [, contractBal] = await contracts.settlement.getEscrowInfo();
        
        const totalPayoutBN = isEthersV6 ? BigInt(totalPayout) : totalPayout;
        const contractBalBN = isEthersV6 ? BigInt(contractBal) : contractBal;
        
        if (contractBalBN < totalPayoutBN) {
            const shortfall = formatEtherSafe(totalPayoutBN - contractBalBN);
            showStatus(`❌ escrow 余额不足，还差 ${shortfall} ETH，请通知买家先预存货款。`, 'error', 'settlementStatus');
            return;
        }

        showStatus('执行清算中...', 'warning', 'settlementStatus');
        const tx = await contracts.settlement.executeSettlement(batchId);
        await tx.wait();
        showStatus('✅ 清算执行成功！净额已支付给商家。', 'success', 'settlementStatus');
        await loadSettlementBatches();
    } catch (e) { showStatus('执行失败：' + e.message, 'error', 'settlementStatus'); }
}

async function loadSettlementBatches() {
    const list = document.getElementById('settlementBatchesList');
    try {
        // Update escrow balance
        const [, contractBal] = await contracts.settlement.getEscrowInfo();
        document.getElementById('escrowBalance').textContent = parseFloat(formatEtherSafe(contractBal)).toFixed(4);

        const total = toNumberSafe(await contracts.settlement.nextBatchId());
        if (total === 0) { list.innerHTML = '<p>暂无清算批次</p>'; return; }
        const statusNames = ['📋 待审批', '✅ 已审批', '💰 已执行', '❌ 已拒绝'];
        const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';
        let html = '';
        for (let i = total - 1; i >= 0; i--) {
            const b = await contracts.settlement.getBatch(i);
            const status = toNumberSafe(b.status);
            let actionBtn = '';
            if (isLeader) {
                if (status === 0) {
                    actionBtn = `<p style="margin-top:10px;font-size:0.85em;color:var(--text-muted);">多签审批中，请相关方到「多签钱包」标签页确认</p>`;
                } else if (status === 1) {
                    actionBtn = `<button class="btn btn-success" style="margin-top:10px;padding:6px 16px;" onclick="quickExecuteSettlement(${i})">执行净额清算</button>`;
                } else if (status === 2) {
                    actionBtn = `<p style="margin-top:10px;font-size:0.85em;color:#51cf66;">资金已划转完成</p>`;
                }
            }
            html += `<div class="batch-item">
                <h4>清算批次 #${i} ${statusNames[status] || ''}</h4>
                <div class="batch-details">
                    <div class="detail-item"><span class="detail-label">对账批次:</span><span>#${toNumberSafe(b.reconciliationBatchId)}</span></div>
                    <div class="detail-item"><span class="detail-label">待支付总额:</span><span>${formatEtherSafe(b.totalPayout)} ETH</span></div>
                    <div class="detail-item"><span class="detail-label">已支付方数:</span><span>${toNumberSafe(b.settledCount)}</span></div>
                    <div class="detail-item"><span class="detail-label">状态:</span><span>${statusNames[status]}</span></div>
                </div>
                ${actionBtn}
            </div>`;
        }
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

// 团长在清算批次卡片内执行清算
async function quickExecuteSettlement(batchId) {
    document.getElementById('executeSettlementId').value = batchId;
    await executeSettlement();
    await loadSettlementBatches();
}
window.quickExecuteSettlement = quickExecuteSettlement;

// ==================== Disputes ====================
async function createDispute() {
    try {
        const orderId = parseInt(document.getElementById('disputeOrderId').value);
        const reason = document.getElementById('disputeReason').value;
        if (isNaN(orderId) || !reason) { showStatus('请填写完整', 'error', 'disputeStatus'); return; }
        console.log('发起争议，订单ID:', orderId, '原因:', reason);
        showStatus('发起争议中...', 'warning', 'disputeStatus');
        const tx = await contracts.dispute.createDispute(orderId, reason, { gasLimit: 300000 });
        console.log('交易已发送，哈希:', tx.hash);
        await tx.wait();
        console.log('交易已确认');
        showStatus('争议已发起！', 'success', 'disputeStatus');
        await loadDisputes();
    } catch (e) {
        console.error('发起争议失败:', e);
        showStatus('发起失败：' + e.message, 'error', 'disputeStatus');
    }
}

async function resolveDispute() {
    try {
        const disputeId = parseInt(document.getElementById('resolveDisputeId').value);
        const sellerAtFault = document.getElementById('resolveFault').value === 'true';
        const amount = parseEtherSafe(document.getElementById('resolveAmount').value || '0');
        const dispute = await contracts.dispute.getDispute(disputeId);
        if (toNumberSafe(dispute.status) === 0) {
            showStatus('争议尚未进入审查，正在自动认领...', 'warning', 'disputeStatus');
            const assignTx = await contracts.dispute.assignArbitrator(disputeId);
            await assignTx.wait();
        }
        const tx = await contracts.dispute.resolveDispute(disputeId, sellerAtFault, amount);
        showStatus('裁决中...', 'warning', 'disputeStatus');
        await tx.wait();
        showStatus('裁决完成！', 'success', 'disputeStatus');
        await loadDisputes();
    } catch (e) { showStatus('裁决失败：' + e.message, 'error', 'disputeStatus'); }
}

async function loadDisputes() {
    const list = document.getElementById('disputesList');
    try {
        const total = toNumberSafe(await contracts.dispute.nextDisputeId());
        const statusNames = ['开放', '审查中', '已裁决', '已执行', '已关闭'];
        const isLeader = currentUserRole === 'leader' || currentUserRole === 'admin';

        let html = '';
        if (total === 0) {
            html = '<p>暂无争议</p>';
        } else {
            for (let i = total - 1; i >= 0; i--) {
                const d = await contracts.dispute.getDispute(i);
                const status = toNumberSafe(d.status);
                let actionBtn = '';
                if (isLeader && (status === 0 || status === 1)) {
                    actionBtn = `<button class="btn btn-warning" style="margin-top:10px;padding:6px 16px;" onclick="openResolveDispute(${i})">认领并裁决</button>
                    <div id="resolveForm-${i}" style="display:none;margin-top:10px;padding:10px;background:rgba(108,92,231,0.06);border-radius:8px;">
                        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                            <label style="font-size:0.85em;">责任方</label>
                            <select id="resolveFault-${i}" style="padding:6px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;">
                                <option value="true">卖方责任</option>
                                <option value="false">买方责任</option>
                            </select>
                            <label style="font-size:0.85em;">赔偿金额 (ETH)</label>
                            <input type="text" id="resolveAmount-${i}" placeholder="0.005" style="width:120px;padding:6px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;">
                            <button class="btn btn-success" style="padding:6px 14px;" onclick="submitResolveInline(${i})">提交裁决</button>
                        </div>
                    </div>`;
                } else if (isLeader && status === 2) {
                    actionBtn = `<button class="btn btn-success" style="margin-top:10px;padding:6px 16px;" onclick="executeDispute(${i})">执行退款</button>`;
                }
                html += `<div class="dispute-item">
                    <h4>争议 #${toNumberSafe(d.disputeId)} - 订单 #${toNumberSafe(d.orderId)}</h4>
                    <div class="dispute-details">
                        <div class="detail-item"><span class="detail-label">发起人:</span><span>${addrName(d.initiator)}</span></div>
                        <div class="detail-item"><span class="detail-label">状态:</span><span>${statusNames[status]}</span></div>
                        <div class="detail-item"><span class="detail-label">原因:</span><span>${d.reason}</span></div>
                        <div class="detail-item"><span class="detail-label">裁决:</span><span>${d.sellerAtFault ? '卖方责任' : (status >= 2 ? '买方责任' : '-')}</span></div>
                    </div>
                    ${actionBtn}
                </div>`;
            }
        }
        list.innerHTML = html;

        // 同时加载买家/商家可发起争议的订单列表
        await loadDisputableOrders();
    } catch (e) { list.innerHTML = '<p>加载失败: ' + e.message + '</p>'; }
}

// 买家/商家：加载可发起争议的订单
async function loadDisputableOrders() {
    const section = document.getElementById('disputableOrdersSection');
    const list = document.getElementById('disputableOrdersList');
    if (!section || !list) return;
    if (currentUserRole !== 'buyer' && currentUserRole !== 'seller') {
        section.style.display = 'none';
        return;
    }
    try {
        list.innerHTML = '<p>加载中...</p>';
        const nextOrderId = toNumberSafe(await contracts.orderStorage.nextOrderId());
        const cards = [];
        for (let oid = 0; oid < nextOrderId; oid++) {
            const o = await contracts.orderStorage.getOrder(oid);
            const buyerMatch = o.buyer.toLowerCase() === userAddress.toLowerCase();
            const sellerMatch = o.seller.toLowerCase() === userAddress.toLowerCase();
            if (!buyerMatch && !sellerMatch) continue;
            if (o.reconciled || o.disputed) continue;
            const amountEth = formatEtherSafe(o.amount);
            cards.push(`<div class="order-item">
                <h4>订单 #${oid}</h4>
                <div class="order-details">
                    <div class="detail-item"><span class="detail-label">买家:</span><span>${addrName(o.buyer)}</span></div>
                    <div class="detail-item"><span class="detail-label">卖家:</span><span>${addrName(o.seller)}</span></div>
                    <div class="detail-item"><span class="detail-label">金额:</span><span>${amountEth} ETH</span></div>
                </div>
                <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <input type="text" id="reason-${oid}" placeholder="争议原因" style="flex:1;min-width:200px;padding:6px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;">
                    <button class="btn btn-warning" style="padding:6px 14px;" onclick="quickCreateDisputeWithReason(${oid})">发起争议</button>
                </div>
            </div>`);
        }
        section.style.display = '';
        list.innerHTML = cards.length > 0 ? cards.join('') : '<p>当前没有可发起争议的订单（订单未上链、已对账或已争议的不显示）</p>';
    } catch (e) {
        list.innerHTML = '<p>加载失败：' + e.message + '</p>';
    }
}

async function quickCreateDispute(orderId) {
    const reason = prompt(`请输入针对链上订单 #${orderId} 的争议原因：`, '');
    if (!reason) return;
    document.getElementById('disputeOrderId').value = orderId;
    document.getElementById('disputeReason').value = reason;
    await createDispute();
}
window.quickCreateDispute = quickCreateDispute;

async function quickCreateDisputeWithReason(orderId) {
    const reason = document.getElementById(`reason-${orderId}`).value.trim();
    if (!reason) { showStatus('请填写争议原因', 'error', 'disputeStatus'); return; }
    document.getElementById('disputeOrderId').value = orderId;
    document.getElementById('disputeReason').value = reason;
    await createDispute();
    await loadDisputableOrders();
}
window.quickCreateDisputeWithReason = quickCreateDisputeWithReason;

function openResolveDispute(disputeId) {
    const form = document.getElementById(`resolveForm-${disputeId}`);
    if (form) form.style.display = form.style.display === 'none' ? '' : 'none';
}
window.openResolveDispute = openResolveDispute;

async function submitResolveInline(disputeId) {
    const fault = document.getElementById(`resolveFault-${disputeId}`).value;
    const amount = document.getElementById(`resolveAmount-${disputeId}`).value.trim() || '0';
    document.getElementById('resolveDisputeId').value = disputeId;
    document.getElementById('resolveFault').value = fault;
    document.getElementById('resolveAmount').value = amount;
    await resolveDispute();
}
window.submitResolveInline = submitResolveInline;

// 管理员执行裁决：卖方责任时，退款原路退回到买家预存（Settlement escrow）
async function executeDispute(disputeId) {
    try {
        showStatus('执行退款中...', 'warning', 'disputeStatus');
        let fee;
        try {
            const feeData = await provider.getFeeData();
            const base = feeData.maxFeePerGas || parseUnitsSafe('1', 'gwei');
            const tip = feeData.maxPriorityFeePerGas || parseUnitsSafe('0', 'gwei');
            fee = { maxFeePerGas: base, maxPriorityFeePerGas: tip };
        } catch (_) { fee = {}; }
        const tx = await contracts.dispute.executeDispute(disputeId, { gasLimit: 200000, ...fee });
        await tx.wait();
        showStatus('✅ 退款执行完成！', 'success', 'disputeStatus');
        await loadDisputes();
        if (typeof loadBuyerPaymentInfo === 'function') await loadBuyerPaymentInfo();
    } catch (e) { showStatus('执行失败：' + e.message, 'error', 'disputeStatus'); }
}
window.executeDispute = executeDispute;

// ==================== MultiSig ====================
async function submitTransaction() {
    try {
        let recipient = document.getElementById('txRecipient').value.trim();
        recipient = ethers.getAddress(recipient);
        const amount = parseEtherSafe(document.getElementById('txAmount').value || '0');
        const data = document.getElementById('txData').value || '0x';
        const tx = await contracts.multisig.submitTransaction(recipient, amount, data);
        showStatus('提交中...', 'warning', 'multisigStatus');
        await tx.wait();
        showStatus('多签交易已提交！', 'success', 'multisigStatus');
        await loadMultisig();
    } catch (e) { showStatus('提交失败：' + e.message, 'error', 'multisigStatus'); }
}

async function confirmTransaction() {
    try {
        const txId = parseInt(document.getElementById('confirmTxId').value);
        const tx = await contracts.multisig.confirmTransaction(txId);
        showStatus('确认中...', 'warning', 'multisigStatus');
        await tx.wait();
        showStatus('已确认！', 'success', 'multisigStatus');
        await loadMultisig();
    } catch (e) { showStatus('确认失败：' + e.message, 'error', 'multisigStatus'); }
}

async function confirmMultisigTx(txId) {
    document.getElementById('confirmTxId').value = txId;
    await confirmTransaction();
}

async function executeTransaction() {
    try {
        const txId = parseInt(document.getElementById('executeTxId').value);
        const tx = await contracts.multisig.executeTransaction(txId);
        showStatus('执行中...', 'warning', 'multisigStatus');
        await tx.wait();
        showStatus('交易已执行！', 'success', 'multisigStatus');
        await loadMultisig();
    } catch (e) { showStatus('执行失败：' + e.message, 'error', 'multisigStatus'); }
}

async function executeMultisigTx(txId) {
    document.getElementById('executeTxId').value = txId;
    await executeTransaction();
}

async function depositToMultisig() {
    try {
        const amount = parseEtherSafe(document.getElementById('multisigDepositAmount').value);
        let fee;
        try {
            const feeData = await provider.getFeeData();
            const base = feeData.maxFeePerGas || parseUnitsSafe('1', 'gwei');
            const tip = feeData.maxPriorityFeePerGas || parseUnitsSafe('0', 'gwei');
            fee = { maxFeePerGas: base, maxPriorityFeePerGas: tip };
        } catch (_) { fee = {}; }
        const tx = await signer.sendTransaction({ to: CONTRACT_ADDRESSES.multisig, value: amount, gasLimit: 60000, ...fee });
        showStatus('充值中...', 'warning', 'multisigStatus');
        await tx.wait();
        showStatus('充值成功！', 'success', 'multisigStatus');
        await loadMultisig();
    } catch (e) { showStatus('充值失败：' + e.message, 'error', 'multisigStatus'); }
}

async function loadMultisig() {
    try {
        // 并发限流（局部）
        async function mapLimit(arr, limit, iter) {
            const ret = new Array(arr.length);
            let i = 0, active = 0, done = 0;
            return await new Promise((resolve, reject) => {
                function next() {
                    if (done === arr.length) { resolve(ret); return; }
                    while (active < limit && i < arr.length) {
                        const cur = i++;
                        active++;
                        Promise.resolve(iter(arr[cur], cur))
                            .then(v => { ret[cur] = v; active--; done++; next(); })
                            .catch(reject);
                    }
                }
                next();
            });
        }

        // 检测并显示待审批的清算通知（并发扫描）
        const noticeEl = document.getElementById('multisigSettlementNotice');
        if (noticeEl) {
            noticeEl.style.display = 'none';
            if (contracts.settlement) {
                const nextSettleId = toNumberSafe(await contracts.settlement.nextBatchId());
                const idx = Array.from({ length: nextSettleId }, (_, i) => i);
                const statuses = await mapLimit(idx, 8, async (s) => toNumberSafe((await contracts.settlement.getBatch(s)).status));
                if (statuses.some(st => st === 0)) noticeEl.style.display = 'block';
            }
        }

        // 基本信息并发拉取
        const [owners, required, balance] = await Promise.all([
            contracts.multisig.getOwners(),
            contracts.multisig.required().then(toNumberSafe),
            provider.getBalance(CONTRACT_ADDRESSES.multisig)
        ]);
        document.getElementById('multisigRequired').textContent = required;
        document.getElementById('multisigBalance').textContent = parseFloat(formatEtherSafe(balance)).toFixed(4);
        document.getElementById('multisigOwners').innerHTML = owners.map(o =>
            `${addrName(o)}${o.toLowerCase() === userAddress.toLowerCase() ? ' (当前)' : ''}`
        ).join('<br>');

        // 交易记录：最近10条，逐条占位 + 并发填充
        const txCount = toNumberSafe(await contracts.multisig.getTransactionCount());
        const list = document.getElementById('transactionsList');
        if (txCount === 0) { list.innerHTML = '<p>暂无交易</p>'; return; }
        const headCount = Math.min(txCount, 10);
        const ids = Array.from({ length: headCount }, (_, k) => txCount - 1 - k);
        list.innerHTML = ids.map(i => `<div id="ms-tx-${i}" class="order-item"><div style="color:var(--text-muted);">加载交易 #${i}...</div></div>`).join('');

        const groupOrdersCache = window.__groupOrdersCache || new Map();
        window.__groupOrdersCache = groupOrdersCache;

        await mapLimit(ids, 8, async (i) => {
            try {
                const [t, confirmedByMe] = await Promise.all([
                    contracts.multisig.getTransaction(i),
                    contracts.multisig.isConfirmed(i, userAddress)
                ]);
                let title = '普通多签交易';
                let details = '';
                let actionHint = confirmedByMe ? '你已确认' : '等待你确认';
                let actionColor = confirmedByMe ? '#51cf66' : '#ffd43b';
                let canBusinessConfirm = owners.map(o => o.toLowerCase()).includes(userAddress.toLowerCase());

                if (t.to && t.data && t.data !== '0x' && t.to.toLowerCase() === CONTRACT_ADDRESSES.settlement.toLowerCase()) {
                    try {
                        const iface = isEthersV6 ? new ethers.Interface(["function approveSettlement(uint256)"]) : new ethers.utils.Interface(["function approveSettlement(uint256)"]);
                        const decoded = iface.decodeFunctionData("approveSettlement", t.data);
                        const settlementBatchId = toNumberSafe(decoded[0]);
                        const batch = await contracts.settlement.getBatch(settlementBatchId);
                        const reconBatch = await contracts.reconciliation.getBatch(toNumberSafe(batch.reconciliationBatchId));
                        const gid = toNumberSafe(reconBatch.groupId);
                        let groupOrders = groupOrdersCache.get(gid);
                        if (!groupOrders) { groupOrders = await contracts.orderStorage.getGroupOrders(gid); groupOrdersCache.set(gid, groupOrders); }
                        title = `审批清算批次 #${settlementBatchId}`;
                        details = `
                            <div class="detail-item"><span class="detail-label">业务:</span><span>批准净额清算</span></div>
                            <div class="detail-item"><span class="detail-label">清算批次:</span><span>#${settlementBatchId}</span></div>
                            <div class="detail-item"><span class="detail-label">对账批次:</span><span>#${toNumberSafe(batch.reconciliationBatchId)}</span></div>
                            <div class="detail-item"><span class="detail-label">相关商家:</span><span>${[...new Set(groupOrders.map(o => addrName(o.seller)))].join('、')}</span></div>
                            <div class="detail-item"><span class="detail-label">相关买家:</span><span>${[...new Set(groupOrders.map(o => addrName(o.buyer)))].join('、')}</span></div>
                            <div class="detail-item"><span class="detail-label">待支付总额:</span><span>${formatEtherSafe(batch.totalPayout)} ETH</span></div>
                        `;
                    } catch (_) {
                        details = `<div class="detail-item"><span class="detail-label">业务:</span><span>未知合约调用</span></div>`;
                    }
                }

                const cardHtml = `
                    <h4>${title}（交易 #${i}） ${t.executed ? '✅ 已执行' : `⏳ ${toNumberSafe(t.numConfirmations)}/${required} 确认`}</h4>
                    <div class="order-details">
                        ${details}
                        <div class="detail-item"><span class="detail-label">当前状态:</span><span style="color:${actionColor}">${t.executed ? '已执行' : actionHint}</span></div>
                    </div>
                    ${!t.executed && !confirmedByMe && canBusinessConfirm ? `<button class=\"btn btn-success\" style=\"margin-top:10px;\" onclick=\"confirmMultisigTx(${i})\">确认这笔交易</button>` : ''}
                    ${!t.executed && toNumberSafe(t.numConfirmations) >= required ? `<button class=\"btn\" style=\"margin-top:10px;margin-left:8px;\" onclick=\"executeMultisigTx(${i})\">执行这笔交易</button>` : ''}
                `;
                const mount = document.getElementById(`ms-tx-${i}`);
                if (mount) mount.innerHTML = cardHtml;
            } catch (err) {
                const mount = document.getElementById(`ms-tx-${i}`);
                if (mount) mount.innerHTML = `<div style="color:#ff6b6b;">加载交易 #${i} 失败：${err.message || err}</div>`;
            }
        });
        await refreshMultisigRedDot();
    } catch (e) { console.error('loadMultisig:', e); }
}

// ==================== Utility ====================
function showStatus(message, type, containerId) {
    const el = document.getElementById(containerId);
    if (el) {
        // 支持 HTML 片段（用于嵌入下一步操作链接）
        if (typeof message === 'string' && message.indexOf('<') !== -1) {
            el.innerHTML = message;
        } else {
            el.textContent = message;
        }
        el.className = `status ${type}`;
        el.style.display = 'block';
        if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 8000);
    }
}

window.loadSellerBillPreview = loadSellerBillPreview;
window.proposeSettlement = proposeSettlement;
window.submitApprovalToMultisig = submitApprovalToMultisig;
window.confirmMultisigTx = confirmMultisigTx;
window.executeMultisigTx = executeMultisigTx;
window.resolveDispute = resolveDispute;

// 全选或取消全选全部订单里的 checkbox
function toggleAllOrderCheckboxes(checked) {
    const checkboxes = document.querySelectorAll('.pending-order-cb');
    checkboxes.forEach(cb => { cb.checked = checked; });
}
window.toggleAllOrderCheckboxes = toggleAllOrderCheckboxes;
