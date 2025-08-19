const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

// 加载环境变量
dotenv.config();

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guessing-game';

console.log('Connecting to MongoDB...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('✅ Successfully connected to MongoDB');
  
  try {
    // 检查是否已存在管理员用户
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      console.log('Creating default admin user...');
      
      // 创建默认管理员用户
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        score: 0
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created:');
      console.log('  Username: admin');
      console.log('  Email: admin@example.com');
      console.log('  Password: admin123');
      console.log('  Role: admin');
      console.log('\n⚠️  Please change the default password after first login!');
    } else {
      console.log('Admin user already exists, skipping creation.');
    }
    
    // 显示数据库统计
    const userCount = await User.countDocuments();
    console.log(`\n📊 Database statistics:`);
    console.log(`  Total users: ${userCount}`);
    
    const adminCount = await User.countDocuments({ role: 'admin' });
    console.log(`  Admin users: ${adminCount}`);
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nConnection closed');
  }
}).catch(err => {
  console.log('❌ Failed to connect to MongoDB');
  console.error('Error:', err.message);
});