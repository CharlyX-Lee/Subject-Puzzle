const { exec } = require('child_process');
const fs = require('fs');

// 检查是否已安装依赖
if (!fs.existsSync('./node_modules')) {
  console.log('正在安装依赖...');
  exec('npm install', (error, stdout, stderr) => {
    if (error) {
      console.error(`安装依赖时出错: ${error}`);
      return;
    }
    console.log('依赖安装完成');
    startServers();
  });
} else {
  startServers();
}

function startServers() {
  console.log('正在启动服务器...');
  
  // 启动游戏服务器
  const gameServer = exec('node server.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`启动游戏服务器时出错: ${error}`);
      return;
    }
  });
  
  gameServer.stdout.on('data', (data) => {
    console.log('[Game Server] ' + data.toString());
  });
  
  gameServer.stderr.on('data', (data) => {
    console.error('[Game Server] ' + data.toString());
  });
  
  // 启动管理服务器
  const adminServer = exec('node admin.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`启动管理服务器时出错: ${error}`);
      return;
    }
  });
  
  adminServer.stdout.on('data', (data) => {
    console.log('[Admin Server] ' + data.toString());
  });
  
  adminServer.stderr.on('data', (data) => {
    console.error('[Admin Server] ' + data.toString());
  });
  
  console.log('游戏服务器已在端口 5001 上启动');
  console.log('管理服务器已在端口 5000 上启动');
  console.log('请在浏览器中访问 http://localhost:5001 进行游戏或 http://localhost:5000 进行管理');
}