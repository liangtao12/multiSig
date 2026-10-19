const { ethers } = require("ethers");

// 向部署账户转入 ETH（从 geth --dev 的预置账户）
// geth --dev 模式会自动解锁一个预充值的 coinbase 账户

const RPC_URL = "http://127.0.0.1:8545";
const FUND_AMOUNT = "100"; // ETH per account

const ACCOUNTS_TO_FUND = [
  "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
  "0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63",
  "0x41D0399A2002c6DAFB0C00Ce4E3aFdC3D8E53660",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // 获取 geth dev 模式的 coinbase（已解锁的预充值账户）
  const accounts = await provider.send("eth_accounts", []);
  if (accounts.length === 0) {
    throw new Error("No unlocked accounts found on geth node. Make sure geth is running in --dev mode.");
  }
  const devAccount = accounts[0];
  console.log("Geth dev account (coinbase):", devAccount);

  const balance = await provider.getBalance(devAccount);
  console.log("Dev account balance:", ethers.formatEther(balance), "ETH\n");

  for (const addr of ACCOUNTS_TO_FUND) {
    const tx = await provider.send("eth_sendTransaction", [
      {
        from: devAccount,
        to: addr,
        value: ethers.toQuantity(ethers.parseEther(FUND_AMOUNT)),
      },
    ]);
    const receipt = await provider.waitForTransaction(tx);
    const bal = await provider.getBalance(addr);
    console.log(`Funded ${addr} -> ${ethers.formatEther(bal)} ETH (block ${receipt.blockNumber})`);
  }

  console.log("\nAll accounts funded.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
