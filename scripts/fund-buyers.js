const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8545";
const DEPLOYER_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

// 买家账户（Hardhat 默认助记词生成的后续账户）
const BUYERS = [
    { name: "买家1", address: "0x83d0066B956aD53CA640B3446A87eF8c26CDEf97", key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000004" },
    { name: "买家2", address: "0xB9be241549418558776f510CB9167673CaEaF4C0", key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000001" },
    { name: "买家3", address: "0xd34e3AC5d30D92C7b13fdb591FA41F00d9B4CB67", key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000000" },
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

    console.log("给买家账户转入 ETH...\n");

    for (const buyer of BUYERS) {
        const balance = await provider.getBalance(buyer.address);
        const balEth = parseFloat(ethers.formatEther(balance));

        if (balEth < 1) {
            const tx = await deployer.sendTransaction({
                to: buyer.address,
                value: ethers.parseEther("5"),
            });
            await tx.wait();
            console.log(`  ✅ ${buyer.name} (${buyer.address}) - 转入 5 ETH`);
        } else {
            console.log(`  ⏭️  ${buyer.name} (${buyer.address}) - 余额 ${balEth.toFixed(2)} ETH，跳过`);
        }
    }

    console.log("\n🎉 买家账户准备完毕！");
    console.log("\n📋 所有账户汇总：");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("角色        | 地址                                       | 私钥");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`管理员/团长  | 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb | 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`);
    console.log(`商家A       | 0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63 | 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000003`);
    console.log(`商家B       | 0x41D0399A2002c6DAFB0C00Ce4E3aFdC3D8E53660 | 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890000002`);
    for (const buyer of BUYERS) {
        console.log(`${buyer.name}       | ${buyer.address} | ${buyer.key}`);
    }
    console.log("═══════════════════════════════════════════════════════════════");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
