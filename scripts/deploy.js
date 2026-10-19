const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Geth 开发节点 RPC 地址
const RPC_URL = "http://127.0.0.1:8545";
// 部署者私钥（geth --dev 模式下的预置账户，或自行替换）
const DEPLOYER_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const artifactsDir = path.join(__dirname, "..", "artifacts");

// 部署时自动清空链下订单数据
const dataFile = path.join(__dirname, "..", "data", "orders.json");
if (fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]", "utf8");
  console.log("🗑️  链下订单数据已清空");
}

function loadArtifact(name) {
  const filePath = path.join(artifactsDir, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found: ${filePath}\nPlease run 'npm run compile' first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function updateFrontendAddresses(addresses) {
  const appJsPath = path.join(__dirname, "..", "frontend", "app.js");
  const content = fs.readFileSync(appJsPath, "utf8");
  const replacement =
    "const CONTRACT_ADDRESSES = {\n" +
    `    productRegistry: "${addresses.productRegistry}",\n` +
    `    orderStorage: "${addresses.orderStorage}",\n` +
    `    reconciliation: "${addresses.reconciliation}",\n` +
    `    settlement: "${addresses.settlement}",\n` +
    `    dispute: "${addresses.dispute}",\n` +
    `    multisig: "${addresses.multisig}"\n` +
    "};";

  const next = content.replace(
    /const CONTRACT_ADDRESSES\s*=\s*\{[\s\S]*?\};/,
    replacement
  );

  fs.writeFileSync(appJsPath, next, "utf8");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function deployContract(signer, artifact, ...args) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  // 显式获取最新 nonce 防止 geth nonce 缓存问题
  const nonce = await signer.getNonce("pending");
  // 显式提供 gasLimit，绕过 estimateGas 阶段可能触发的 "invalid opcode: SHL"
  const contract = await factory.deploy(...args, { nonce, gasLimit: 5_000_000 });

  // 带重试的等待部署（处理 geth "transaction indexing is in progress"）
  let address;
  let retries = 20; // up to ~100s total wait
  while (retries > 0) {
    try {
      await contract.waitForDeployment();
      await sleep(5000);
      address = await contract.getAddress();
      console.log(`  ${artifact.contractName} deployed to: ${address}`);
      return contract;
    } catch (e) {
      const msg = String(e && e.message || e);
      if ((msg.includes('transaction indexing is in progress') || msg.includes('could not coalesce error')) && retries > 0) {
        console.log(`  Transaction indexing in progress, retrying... (${retries} attempts left)`);
        await sleep(5000);
        retries--;
        continue;
      }
      if (msg.includes('invalid opcode: SHL') && retries > 0) {
        console.log(`  RPC estimate issue detected, waiting and retrying... (${retries} attempts left)`);
        await sleep(5000);
        retries--;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Failed to deploy ${artifact.contractName} after retries`);
}

async function grantRoleIfMissing(contract, role, account) {
  const has = await contract.hasRole(role, account);
  if (!has) {
    const tx = await contract.grantRole(role, account, { gasLimit: 1_000_000 });
    let retries = 10;
    while (retries > 0) {
      try {
        await tx.wait();
        break;
      } catch (e) {
        const msg = String(e && e.message || e);
        if ((msg.includes('transaction indexing is in progress') || msg.includes('could not coalesce error')) && retries > 0) {
          await sleep(3000);
          retries--;
          continue;
        }
        throw e;
      }
    }
    await sleep(1000);
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  console.log("Deploying contracts with the account:", deployer.address);

  // 角色地址分配
  // deployer = 平台管理员 + 团长
  // account2 = 商家A (seller)
  // account3 = 商家B (seller)
  // buyer1   = 买家代表（参与多签审批）
  const account2 = "0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63";
  const account3 = "0x41D0399A2002c6DAFB0C00Ce4E3aFdC3D8E53660";
  const buyer1   = "0x83d0066B956aD53CA640B3446A87eF8c26CDEf97";

  // 加载编译产物
  const MultiSigWalletArtifact = loadArtifact("MultiSigWallet");
  const ProductRegistryArtifact = loadArtifact("ProductRegistry");
  const OrderStorageArtifact = loadArtifact("OrderStorage");
  const ReconciliationArtifact = loadArtifact("Reconciliation");
  const SettlementArtifact = loadArtifact("Settlement");
  const DisputeArtifact = loadArtifact("Dispute");

  // 买家账户
  const buyer2   = "0xB9be241549418558776f510CB9167673CaEaF4C0";
  const buyer3   = "0xd34e3AC5d30D92C7b13fdb591FA41F00d9B4CB67";

  // 1. 部署 MultiSigWallet（所有参与方均为 owner，任意三方确认即可）
  console.log("\n--- Deploying MultiSigWallet ---");
  const owners = [deployer.address, account2, account3, buyer1, buyer2, buyer3];
  const required = 3;
  const multiSigWallet = await deployContract(deployer, MultiSigWalletArtifact, owners, required);
  const multiSigWalletAddress = await multiSigWallet.getAddress();

  // 2. 部署 ProductRegistry（商品注册）
  console.log("\n--- Deploying ProductRegistry ---");
  const productRegistry = await deployContract(deployer, ProductRegistryArtifact);
  const productRegistryAddress = await productRegistry.getAddress();

  // 3. 部署 OrderStorage（订单存储，关联商品注册）
  console.log("\n--- Deploying OrderStorage ---");
  const orderStorage = await deployContract(deployer, OrderStorageArtifact, productRegistryAddress);
  const orderStorageAddress = await orderStorage.getAddress();

  // 4. 部署 Reconciliation（对账合约）
  console.log("\n--- Deploying Reconciliation ---");
  const reconciliation = await deployContract(deployer, ReconciliationArtifact, orderStorageAddress);
  const reconciliationAddress = await reconciliation.getAddress();

  // 5. 部署 Settlement（清算合约，关联多签）
  console.log("\n--- Deploying Settlement ---");
  const settlement = await deployContract(deployer, SettlementArtifact, orderStorageAddress, reconciliationAddress, multiSigWalletAddress);
  const settlementAddress = await settlement.getAddress();

  // 6. 部署 Dispute（争议合约，关联 Settlement 以便原路退回到 escrow）
  console.log("\n--- Deploying Dispute ---");
  const dispute = await deployContract(deployer, DisputeArtifact, orderStorageAddress, settlementAddress);
  const disputeAddress = await dispute.getAddress();

  // --- 角色授予 ---
  console.log("\n--- Granting Roles ---");

  // OPERATOR_ROLE: 给所有合约的操作者（deployer + 合约间调用）
  const operatorRole = await orderStorage.OPERATOR_ROLE();
  const allContracts = [orderStorage, reconciliation, settlement, dispute, productRegistry];
  for (const c of allContracts) {
    await grantRoleIfMissing(c, operatorRole, deployer.address);
  }

  // 允许 Dispute 在 Settlement 上执行 OPERATOR 操作（用于 depositEscrowFor 原路退回到预存）
  await grantRoleIfMissing(settlement, operatorRole, disputeAddress);

  // OrderStorage 的 OPERATOR_ROLE 需要给 Reconciliation 和 Dispute（它们会调用 markReconciled/markDisputed）
  await grantRoleIfMissing(orderStorage, operatorRole, reconciliationAddress);
  await grantRoleIfMissing(orderStorage, operatorRole, disputeAddress);

  // ProductRegistry 的 OPERATOR_ROLE 需要给 OrderStorage（下单时减库存）
  await grantRoleIfMissing(productRegistry, operatorRole, orderStorageAddress);

  // SELLER_ROLE: 商家可以发布商品和提交账单
  const sellerRole = await productRegistry.SELLER_ROLE();
  await grantRoleIfMissing(productRegistry, sellerRole, account2);
  await grantRoleIfMissing(productRegistry, sellerRole, account3);
  await grantRoleIfMissing(reconciliation, sellerRole, account2);
  await grantRoleIfMissing(reconciliation, sellerRole, account3);
  console.log("  SELLER_ROLE granted to:", account2, account3);

  // GROUP_LEADER_ROLE: 团长可以汇总订单和发起对账
  const groupLeaderRole = await orderStorage.GROUP_LEADER_ROLE();
  await grantRoleIfMissing(orderStorage, groupLeaderRole, deployer.address);
  await grantRoleIfMissing(reconciliation, groupLeaderRole, deployer.address);
  console.log("  GROUP_LEADER_ROLE granted to:", deployer.address);

  // ARBITRATOR_ROLE: 仲裁员
  const arbitratorRole = await dispute.ARBITRATOR_ROLE();
  await grantRoleIfMissing(dispute, arbitratorRole, deployer.address);
  console.log("  ARBITRATOR_ROLE granted to:", deployer.address);

  // --- 更新前端地址 ---
  const allAddresses = {
    productRegistry: productRegistryAddress,
    orderStorage: orderStorageAddress,
    reconciliation: reconciliationAddress,
    settlement: settlementAddress,
    dispute: disputeAddress,
    multisig: multiSigWalletAddress,
  };
  // 同步写一份给后端（库存校验需要）
  fs.writeFileSync(
    path.join(__dirname, "..", "data", "addresses.json"),
    JSON.stringify(allAddresses, null, 2),
    "utf8"
  );
  updateFrontendAddresses({
    productRegistry: productRegistryAddress,
    orderStorage: orderStorageAddress,
    reconciliation: reconciliationAddress,
    settlement: settlementAddress,
    dispute: disputeAddress,
    multisig: multiSigWalletAddress,
  });

  console.log("\n✅ All contracts deployed and roles configured!");
  console.log("   Frontend addresses updated in frontend/app.js");
  console.log("\n📋 Role Summary:");
  console.log(`   Admin/GroupLeader: ${deployer.address}`);
  console.log(`   Seller A:         ${account2}`);
  console.log(`   Seller B:         ${account3}`);
  console.log(`   Buyer1 (多签):    ${buyer1}`);
  console.log(`   MultiSig Owners:  团长+商家A+商家B+买家1+买家2+买家3 (任意3/6确认)`);
  console.log(`   MultiSig Address: ${multiSigWalletAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });