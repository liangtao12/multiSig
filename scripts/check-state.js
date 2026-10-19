const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "http://127.0.0.1:8545";

// 从 app.js 读地址
function getAddresses() {
    const appJs = fs.readFileSync(path.join(__dirname, "..", "frontend", "app.js"), "utf8");
    const get = (name) => {
        const m = appJs.match(new RegExp(`${name}:\\s*"(0x[a-fA-F0-9]+)"`));
        return m ? m[1] : null;
    };
    return {
        settlement: get("settlement"),
        multisig: get("multisig"),
        reconciliation: get("reconciliation"),
        orderStorage: get("orderStorage"),
    };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const addr = getAddresses();
    console.log("Contract addresses:", addr);

    // Settlement getBatch
    const settlement = new ethers.Contract(addr.settlement, [
        "function getBatch(uint256) view returns (tuple(uint256 batchId,uint256 reconciliationBatchId,uint256 proposedAt,uint256 executedAt,uint8 status,uint256 totalPayout,uint256 settledCount))",
        "function nextBatchId() view returns (uint256)",
        "function multiSigWallet() view returns (address)",
    ], provider);

    const nextBatch = await settlement.nextBatchId();
    console.log("\nSettlement nextBatchId:", Number(nextBatch));

    for (let i = 0; i < Number(nextBatch); i++) {
        const b = await settlement.getBatch(i);
        const statusNames = ["Proposed", "Approved", "Executed", "Rejected"];
        console.log(`\n  Batch #${i}:`);
        console.log(`    reconBatchId: ${Number(b.reconciliationBatchId)}`);
        console.log(`    status: ${Number(b.status)} (${statusNames[Number(b.status)]})`);
        console.log(`    totalPayout: ${ethers.formatEther(b.totalPayout)} ETH`);
        console.log(`    proposedAt: ${Number(b.proposedAt)}`);
    }

    const msAddr = await settlement.multiSigWallet();
    console.log("\nSettlement.multiSigWallet:", msAddr);
    console.log("Actual multisig addr:    ", addr.multisig);
    console.log("Match:", msAddr.toLowerCase() === addr.multisig.toLowerCase());

    // Multisig transactions
    const multisig = new ethers.Contract(addr.multisig, [
        "function getTransactionCount() view returns (uint256)",
        "function getTransaction(uint256) view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations)",
    ], provider);

    const txCount = await multisig.getTransactionCount();
    console.log("\nMultisig txCount:", Number(txCount));
    for (let i = 0; i < Number(txCount); i++) {
        const t = await multisig.getTransaction(i);
        console.log(`\n  Tx #${i}:`);
        console.log(`    to: ${t.to}`);
        console.log(`    data: ${t.data}`);
        console.log(`    executed: ${t.executed}`);
        console.log(`    confirmations: ${Number(t.numConfirmations)}`);
    }
}

main().catch(console.error);
