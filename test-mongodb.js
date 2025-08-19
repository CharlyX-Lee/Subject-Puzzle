const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guessing-game';

console.log('Attempting to connect to MongoDB...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Successfully connected to MongoDB');
  console.log('Database name:', mongoose.connection.name);
  
  // 测试创建一个简单的文档
  const testSchema = new mongoose.Schema({
    test: String,
    createdAt: { type: Date, default: Date.now }
  });
  
  const TestModel = mongoose.model('Test', testSchema);
  
  const testDoc = new TestModel({ test: 'MongoDB connection test' });
  testDoc.save()
    .then(doc => {
      console.log('✅ Successfully created test document:', doc.test);
      return TestModel.deleteOne({ _id: doc._id });
    })
    .then(() => {
      console.log('✅ Test document cleaned up');
      mongoose.connection.close();
      console.log('Connection closed');
    })
    .catch(err => {
      console.error('Error during test:', err);
      mongoose.connection.close();
    });
}).catch(err => {
  console.log('❌ Failed to connect to MongoDB');
  console.error('Error:', err.message);
  console.log('\nTroubleshooting tips:');
  console.log('1. Make sure MongoDB is installed and running');
  console.log('2. Check if the MongoDB service is started');
  console.log('3. Verify the connection string in your .env file');
  console.log('4. Default connection string: mongodb://localhost:27017/guessing-game');
});