@echo off
:: ==========================================
:: CGB-Buying One-Click Start Script
:: ==========================================
title CGB-Buying One-Click Launcher

echo ==========================================
echo Step 1: Cleaning historical processes...
echo ==========================================
taskkill /F /IM geth.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo   [OK] Process cleaned.
echo.

echo ==========================================
echo Step 2: Resetting Geth private chain...
echo ==========================================
if exist "geth-data\geth" (
    echo Removing old database...
    rd /s /q "geth-data\geth"
)
if exist "geth-data\keystore" (
    echo Removing old keystore...
    rd /s /q "geth-data\keystore"
)
echo Initializing Geth genesis block...
echo Fixing Clique extraData automatically...
node -e "const fs=require('fs');const p='genesis.json';const g=JSON.parse(fs.readFileSync(p,'utf8'));const addr='0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb';const a=addr.toLowerCase().replace('0x','');g.extradata='0x'+'0'.repeat(64)+a+'0'.repeat(130);fs.writeFileSync(p,JSON.stringify(g,null,2));console.log('extraLen=',g.extradata.length-2);"
call geth init --datadir "geth-data" "genesis.json"
if %errorlevel% neq 0 (
    echo Error: Geth genesis init failed. Please fix genesis.json and retry.
    pause
    exit /b
)
echo Importing default deployer private key...
call geth account import --datadir "geth-data" --password "geth-data\password.txt" "geth-data\deployer-key.txt"
if %errorlevel% neq 0 (
    echo Error: Import deployer key failed.
    pause
    exit /b
)
echo   [OK] Blockchain reset complete!
echo.

echo ==========================================
echo Step 3: Launching Geth node in background...
echo ==========================================
start "GETH PRIVATE NODE" cmd /k "geth --datadir geth-data --networkid 887766 --http --http.api eth,net,web3,personal,miner,clique --http.corsdomain http://localhost:3000 --http.port 8545 --http.addr 127.0.0.1 --syncmode=full --gcmode=archive --mine --miner.etherbase 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb --unlock 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb --password geth-data/password.txt --allow-insecure-unlock --ipcdisable --nodiscover"
echo   Waiting 25 seconds for node warming up...
timeout /t 25 /nobreak >nul
echo.

echo ==========================================
echo Step 4: Compiling and deploying contracts...
echo ==========================================
echo Compiling...
call npm run compile
if %errorlevel% neq 0 (
    echo Error: Contract compile failed!
    pause
    exit /b
)
echo Deploying...
node scripts/deploy.js
if %errorlevel% neq 0 (
    echo Error: Contract deploy failed!
    pause
    exit /b
)
echo   [OK] Contracts deployed successfully!
echo.

echo ==========================================
echo Step 5: Seeding initial products...
echo ==========================================
node scripts/seed-products.js
if %errorlevel% neq 0 (
    echo Error: Product seed failed!
    pause
    exit /b
)
echo   [OK] Products seeded successfully!
echo.

echo ==========================================
echo Step 6: Starting web server & daemon...
echo ==========================================
echo   Opening main app in Firefox: http://localhost:3000/
start firefox "http://localhost:3000/" || start "" "http://localhost:3000/"
node simple-server.js

pause
