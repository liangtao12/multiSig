const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8545";

// 商家A 私钥（拥有 SELLER_ROLE）
const SELLER_A_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000003";
// 商家B 私钥
const SELLER_B_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000002";

// 从前端 app.js 读取合约地址
function getProductRegistryAddress() {
  const appJs = fs.readFileSync(path.join(__dirname, "..", "frontend", "app.js"), "utf8");
  const match = appJs.match(/productRegistry:\s*"(0x[a-fA-F0-9]+)"/);
  if (!match) throw new Error("Cannot find productRegistry address in app.js");
  return match[1];
}

// 预置商品数据
const PRODUCTS_SELLER_A = [
  { name: "有机苹果 5斤装", price: "0.01", stock: 100 },
  { name: "东北大米 10kg", price: "0.025", stock: 50 },
  { name: "鲜鸡蛋 30枚", price: "0.008", stock: 80 },
  { name: "纯牛奶 12盒装", price: "0.015", stock: 60 },
  { name: "新鲜猪肉 2斤", price: "0.02", stock: 40 },
];

const PRODUCTS_SELLER_B = [
  { name: "有机蔬菜套餐", price: "0.012", stock: 70 },
  { name: "进口车厘子 2斤", price: "0.035", stock: 30 },
  { name: "散养土鸡 整只", price: "0.03", stock: 25 },
  { name: "手工水饺 50只装", price: "0.018", stock: 45 },
  { name: "鲜榨橙汁 1L×6", price: "0.022", stock: 55 },
];

const PRODUCT_REGISTRY_ABI = [
  "function createProduct(string,uint256,uint256) returns (uint256)",
  "function nextProductId() view returns (uint256)",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const sellerA = new ethers.Wallet(SELLER_A_KEY, provider);
  const sellerB = new ethers.Wallet(SELLER_B_KEY, provider);

  const address = getProductRegistryAddress();
  console.log("ProductRegistry:", address);

  const registryA = new ethers.Contract(address, PRODUCT_REGISTRY_ABI, sellerA);
  const registryB = new ethers.Contract(address, PRODUCT_REGISTRY_ABI, sellerB);

  console.log(`\n商家A (${sellerA.address}) 发布商品:`);
  for (const p of PRODUCTS_SELLER_A) {
    const nonce = await sellerA.getNonce("pending");
    const tx = await registryA.createProduct(p.name, ethers.parseEther(p.price), p.stock, { nonce });
    await tx.wait();
    await sleep(1000);
    console.log(`  ✅ ${p.name} - ${p.price} ETH × ${p.stock}`);
  }

  console.log(`\n商家B (${sellerB.address}) 发布商品:`);
  for (const p of PRODUCTS_SELLER_B) {
    const nonce = await sellerB.getNonce("pending");
    const tx = await registryB.createProduct(p.name, ethers.parseEther(p.price), p.stock, { nonce });
    await tx.wait();
    await sleep(1000);
    console.log(`  ✅ ${p.name} - ${p.price} ETH × ${p.stock}`);
  }

  const total = await registryA.nextProductId();
  console.log(`\n🎉 共 ${total} 件商品已上架！`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
