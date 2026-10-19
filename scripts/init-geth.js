const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "geth-data");
const genesisFile = path.join(rootDir, "genesis.json");
const keyFile = path.join(dataDir, "deployer-key.txt");
const passwordFile = path.join(dataDir, "password.txt");

// 清除旧链数据（保留密钥和密码文件）
const gethDir = path.join(dataDir, "geth");
if (fs.existsSync(gethDir)) {
  fs.rmSync(gethDir, { recursive: true });
  console.log("Removed old chain data.");
}
const keystoreDir = path.join(dataDir, "keystore");
if (fs.existsSync(keystoreDir)) {
  fs.rmSync(keystoreDir, { recursive: true });
  console.log("Removed old keystore.");
}

// 初始化 genesis
console.log("Initializing geth with genesis.json (chainId: 887766)...\n");
execSync(`geth init --datadir "${dataDir}" "${genesisFile}"`, { stdio: "inherit" });

// 导入部署者私钥
console.log("\nImporting deployer private key...");
try {
  execSync(`geth account import --datadir "${dataDir}" --password "${passwordFile}" "${keyFile}"`, { stdio: "inherit" });
  console.log("Deployer account imported: 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb");
} catch (e) {
  console.log("Account may already exist, continuing...");
}

console.log("\n✅ Initialization complete!");
console.log("Next steps:");
console.log("  1. npm run geth       (start the node)");
console.log("  2. npm run deploy     (deploy contracts)");
console.log("  3. npm start          (start frontend)");
