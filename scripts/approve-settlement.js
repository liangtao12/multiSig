const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "http://127.0.0.1:8545";
const DEPLOYER_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const SELLER_A_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000003";

function getAddresses() {
    const appJs = fs.readFileSync(path.join(__dirname, "..", "frontend", "app.js"), "utf8");
    const get = (name) => {
        const m = appJs.match(new RegExp(`${name}:\\s*"(0x[a-fA-F0-9]+)"`));
        return m ? m[1] : null;
    };
    return { settlement: get("settlement"), multisig: get("multisig") };
}

const MULTISIG_ABI = [
    "function submitTransaction(address,uint256,bytes) returns (uint256)",
    "function confirmTransaction(uint256)",
    "function executeTransaction(uint256)",
    "function getTransactionCount() view returns (uint256)",
    "function getTransaction(uint256) view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations)",
];

const SETTLEMENT_ABI = [
    "function approveSettlement(uint256)",
    "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 reconciliationBatchId,uint256 proposedAt,uint256 executedAt,uint8 status,uint256 totalPayout,uint256 settledCount))",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    const sellerA = new ethers.Wallet(SELLER_A_KEY, provider);
    const addr = getAddresses();

    const multisigDeployer = new ethers.Contract(addr.multisig, MULTISIG_ABI, deployer);
    const multisigSellerA = new ethers.Contract(addr.multisig, MULTISIG_ABI, sellerA);
    const settlement = new ethers.Contract(addr.settlement, SETTLEMENT_ABI, provider);

    // 编码 approveSettlement(0)
    const iface = new ethers.Interface(["function approveSettlement(uint256)"]);
    const calldata = iface.encodeFunctionData("approveSettlement", [0]);
    console.log("Calldata:", calldata);

    // 提交新的多签交易
    console.log("\n1. 提交多签交易...");
    let tx = await multisigDeployer.submitTransaction(addr.settlement, 0, calldata);
    let receipt = await tx.wait();
    const txCount = Number(await multisigDeployer.getTransactionCount());
    const txIndex = txCount - 1;
    console.log(`   多签交易 #${txIndex} 已提交`);

    // 查看数据
    const txData = await multisigDeployer.getTransaction(txIndex);
    console.log("   链上data:", txData.data);

    // deployer 确认
    console.log("\n2. Deployer 确认...");
    tx = await multisigDeployer.confirmTransaction(txIndex);
    await tx.wait();
    console.log("   已确认");

    // sellerA 确认
    console.log("\n3. SellerA 确认...");
    tx = await multisigSellerA.confirmTransaction(txIndex);
    await tx.wait();
    console.log("   已确认");

    // 执行
    console.log("\n4. 执行多签交易...");
    tx = await multisigDeployer.executeTransaction(txIndex);
    await tx.wait();
    console.log("   ✅ 执行成功！");

    // 检查结果
    const batch = await settlement.getBatch(0);
    const statusNames = ["Proposed", "Approved", "Executed", "Rejected"];
    console.log(`\n5. Settlement Batch #0 状态: ${statusNames[Number(batch.status)]}`);
}

main().catch(e => {
    console.error("Error:", e.message || e);
});
