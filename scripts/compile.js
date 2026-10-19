const fs = require("fs");
const path = require("path");
const solc = require("solc");

const contractsDir = path.join(__dirname, "..", "contracts");
const artifactsDir = path.join(__dirname, "..", "artifacts");

// 读取所有 .sol 文件
const solFiles = fs.readdirSync(contractsDir).filter((f) => f.endsWith(".sol"));

const sources = {};
for (const file of solFiles) {
  sources[file] = {
    content: fs.readFileSync(path.join(contractsDir, file), "utf8"),
  };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
    // Geth 私链 genesis 未启用 Shanghai 升级，避免使用 PUSH0 操作码
    evmVersion: "paris",
  },
};

// 处理本地 import
function findImports(importPath) {
  const resolved = path.join(contractsDir, importPath);
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, "utf8") };
  }
  return { error: `File not found: ${importPath}` };
}

console.log("Compiling contracts...");
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// 检查错误
if (output.errors) {
  const fatal = output.errors.filter((e) => e.severity === "error");
  if (fatal.length > 0) {
    console.error("Compilation errors:");
    fatal.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  // 打印警告
  output.errors
    .filter((e) => e.severity === "warning")
    .forEach((e) => console.warn(e.formattedMessage));
}

// 输出 artifacts
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
  for (const [contractName, contractData] of Object.entries(contracts)) {
    const artifact = {
      contractName,
      abi: contractData.abi,
      bytecode: "0x" + contractData.evm.bytecode.object,
    };
    const outPath = path.join(artifactsDir, `${contractName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
    console.log(`  ${contractName} -> artifacts/${contractName}.json`);
  }
}

console.log("Compilation complete.");
