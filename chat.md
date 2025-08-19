# 基于Qwen3大模型的学科海龟汤游戏项目开发流程说明

## 阶段1：Subject-Puzzle的提出

### **用户输入**：

**项目背景**
"我想开发一款能根据初始谜面给出问题不断缩小范围直到猜出最后谜底的游戏，有天文、历史、地理、物理、化学等等学科方向，将通义千问大模型融入其中，作为问题的提出和解答，可以不断根据用户提出的问题给出是或不是答案，并每道题可以提供最多一次比较接近的提示答案。"
"示例流程：玩家选择学科：天文。模型生成一个谜面（如：'一个行星'，答案是'地球'）。第一轮玩家输入'是不是太阳系的'，模型回答'是'；第二轮玩家输入'是不是距离太阳最近的'，模型回答'不是'；第三轮玩家输入'是不是金星'，模型回答'不是'；第四轮玩家输入'是不是地球'，模型回答'恭喜你，答对了！'。随着玩家继续答题，模型的提示不断缩小范围。最后玩家根据谜题和提示猜出正确答案，得分。"
"上面只是举个例子，并不是一定要按照已有的题库体面，我需要你根据Qwen大模型自动生成题面。开发一个有前端有后端的完整程序，通过数据库来完成包括新用户的注册和登录、积分累计，管理员对用户的管理。将这部分内容作为chat.md文档的阶段1：Subject-Puzzle的提出。"

**项目需求**

1. **核心概念**：
   - 开发一款基于Qwen大模型的猜谜游戏
   - 玩家通过提问缩小答案范围
   - 支持天文、历史、地理、物理、化学等多个学科方向
   - 使用Qwen大模型自动生成谜面和回答
   - 每道题提供最多一次提示

2. **游戏流程**：
   - 玩家选择学科方向
   - Qwen大模型生成谜面和答案
   - 玩家通过提问获取"是"/"不是"回答
   - 玩家可获取一次提示
   - 猜中答案或达到最大提问次数结束游戏
   - 根据答题表现累计积分

3. **技术需求**：
   - 前后端分离架构
   - 数据库支持用户管理、游戏会话和积分系统
   - Qwen大模型集成
   - 管理员功能（用户管理、统计信息）
   - 响应式前端界面

##### 初始Prompt序列


"请为Qwen API设计提示词模板，要求生成符合以下JSON格式的谜题：
{
  \"answer\": \"谜底（如：地球）\",
  \"soup\": \"汤面描述（如：这是我们居住的行星，是太阳系中唯一已知存在生命的天体）\",
  \"hint\": \"提示（如：这颗行星上有生命存在）\",
  \"explanation\": \"谜底与汤面关系的简要说明\"
}
要求：

1. 学科由用户选择
2. 答案必须是真实存在的学科术语
3. 谜面要能通过提问逐步推理出答案
4. 提示要能帮助缩小范围但不直接透露答案
5. 答案长度3-10个字符"

### **用户输入**：

"游戏规则页面需要明确说明以下内容：

1. 游戏目标：通过提问猜出谜底
2. 提问规则：只能回答'是'、'不是'、'可能是'、'不确定'等简短回答
3. 提示规则：每道题最多一次提示
4. 积分规则：根据提问次数计算得分
5. 学科划分：天文、历史、地理、物理、化学、生物
6. 游戏结束：猜中答案或达到最大提问次数
7. 答案判断：实时判断是否猜中
8. 游戏历史：记录玩家的问答历史
9. 游戏界面：保持简洁直观的界面设计
10. 交互方式：支持键盘输入和按钮点击"

### **用户输入**：

"请为Qwen API设计提示词模板（用于生成汤面和谜底），要求：

学科：化学
关卡：1
关卡类型：方程式

要求：
1. 从化学学科中选择一个适合第一关的谜底（化学式，3-5个字符）
2. 生成对应的汤面描述（线索）
3. 确保谜底与汤面逻辑一致
4. 谜底必须是真实存在的化学知识

请按以下JSON格式返回：
{
  \"answer\": \"谜底（如Cu₂(OH)₂CO₃）\",
  \"soup\": \"汤面描述（如铜在潮湿空气中生成的绿色物质）\",
  \"explanation\": \"谜底与汤面关系的简要说明\"
}

### 用户输入：

**初始设计思考**：
"前端界面应该保持简洁，重点突出汤面描述、问题输入、回答显示和提示获取。后端需要实现以下功能：

1. 调用Qwen API生成谜题
2. 管理游戏会话状态
3. 处理玩家提问并返回回答
4. 计算得分和累计积分
5. 用户认证和管理
6. 多学科支持"

### **用户输入**：

"游戏规则页面需要展示以下内容：

1. 游戏目标：通过提问猜出谜底
2. 提问规则：只能回答'是'、'不是'、'可能是'、'不确定'等简短回答
3. 提示规则：每道题最多一次提示
4. 积分规则：根据提问次数计算得分
5. 学科划分：天文、历史、地理、物理、化学、生物
6. 游戏结束：猜中答案或达到最大提问次数
7. 答案判断：实时判断是否猜中
8. 游戏历史：记录玩家的问答历史
9. 游戏界面：保持简洁直观的界面设计
10. 交互方式：支持键盘输入和按钮点击"

## 阶段2：Qwen API集成与功能实现

### 开发过程中的Prompt序列

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L220-270，发现无法显示题目内容，需要在不改变前端结构的情况下通过后端实现显示题目"

**用户输入**：
"修改level.html文件，添加检查用户登录状态的功能，但不要改变前端界面结构"

**用户输入**：
"现在程序运行时，进入各个学科具体题目的时候，右上角用户账号没有显示实际用户名，而是显示默认值。请不要改动前端界面，只能将后端实现内容加入前端相应的部分"

**用户输入**：
"查看我之前回复的总结，发现调用Qwen API时缺少错误处理，需要增强错误处理和回退机制"

**用户输入**：
"查看我之前回复的总结，发现获取提示路由有问题，需要修复"

**用户输入**：
"查看我之前回复的总结，发现缺少level字段，需要在GameSession模型中添加level字段并更新相关路由"

**用户输入**：
"查看我之前回复的总结，发现调用Qwen API时需要更严格的响应清理和格式验证"

### 阶段3：问题诊断与Bug修复

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L220-270 成功。问题区域的HTML结构是：
<div class="question-area">
    这里是海龟汤的问题描述区域，后期会与后端结合显示具体问题
</div>。请在不修改HTML结构的情况下，通过JavaScript实现题目内容显示"

**用户输入**：
"修改level.html文件，添加与后端API的交互功能，但不要改变前端界面结构。需要实现以下功能：
1. 页面加载时自动调用后端API获取题目
2. 在.question-area区域显示汤面描述
3. 处理API错误显示友好提示"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L150-200 成功。发现获取提示路由代码如下：
// 获取提示
async function getQwenHint(req, res) {
    const { sessionId } = req.params;
    const { question } = req.body;
    
    try {
        const session = await GameSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: '游戏会话未找到' });
        }
        
        // 本地提示逻辑
        const hint = generateLocalHint(session.answer, question);
        
        res.json({ hint });
    } catch (error) {
        console.error('获取提示错误:', error);
        res.status(500).json({ message: '获取提示失败' });
    }
}
请修改此路由，实现真正的Qwen API调用"

**用户输入**：
"查看文件:e:\Subject-Puzzle\models\GameSession.js 成功。发现当前GameSession模型定义如下：
const gameSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String },
    answer: { type: String },
    hint: { type: String },
    description: { type: String },
    questions: [{
        question: { type: String },
        answer: { type: String }
    }],
    maxQuestions: { type: Number, default: 10 },
    isCompleted: { type: Boolean, default: false },
    isWon: { type: Boolean, default: false },
    score: { type: Number, default: 0 }
});
请添加level字段并更新相关路由"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-316 成功。发现当前JavaScript代码如下：
// 提交答案按钮事件
document.querySelector('.submit-button').addEventListener('click', function() {
    const answer = document.querySelector('.answer-input').value;
    if (answer.trim() === '') {
        alert('请输入答案');
    } else {
        alert('提交答案：' + answer + '\n（此处后期会与后端交互）');
    }
});
请修改此代码，实现与后端API的真实交互"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L220-270 成功。发现当前用户账号显示代码如下：
<div class="user-account" id="usernameDisplay">游客</div>
function checkLoginStatus() {
    const user = localStorage.getItem('user');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    if (user) {
        const userData = JSON.parse(user);
        usernameDisplay.textContent = userData.username;
    } else {
        usernameDisplay.textContent = '游客';
    }
}
请确保这段代码保持不变，通过后端实现用户账号显示"

### 阶段4：功能优化与体验提升

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-319 成功。发现当前提交答案函数如下：
// 提交答案按钮事件
document.querySelector('.submit-button').addEventListener('click', function() {
    const answer = document.querySelector('.answer-input').value;
    if (answer.trim() === '') {
        alert('请输入答案');
    } else {
        alert('提交答案：' + answer + '\n（此处后期会与后端交互）');
    }
});
请修改此函数，实现以下功能：
1. 与后端API交互
2. 显示问答历史
3. 实现游戏结束判断
4. 保持原有界面结构"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L66-L272 成功。发现当前generateQwenPuzzle函数代码如下：
async function generateQwenPuzzle(subject, level) {
    // 本地题库作为回退方案
    const localPuzzles = {
        // ...本地题库代码...
    };
    
    // Qwen API调用逻辑
    try {
        const token = process.env.QWEN_API_KEY;
        const response = await fetch('https://api.example.com/qwen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                // ...Qwen API请求参数...
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return {
                answer: data.choices[0].message.content,
                description: data.choices[0].message.content
            };
        } else {
            console.error('Qwen API错误:', data);
            // 回退到本地题库
            return localPuzzles[subject][level];
        }
    } catch (error) {
        console.error('调用Qwen API错误:', error);
        // 回退到本地题库
        return localPuzzles[subject][level];
    }
}
请优化此函数，确保符合学科要求，添加更严格的响应验证"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-319 成功。发现当前submitAnswer函数如下：
// 提交答案按钮事件
document.querySelector('.submit-button').addEventListener('click', function() {
    const answer = document.querySelector('.answer-input').value;
    if (answer.trim() === '') {
        alert('请输入答案');
    } else {
        alert('提交答案：' + answer + '\n（此处后期会与后端交互）');
    }
});
请修改此函数，实现与后端API的完整交互，包括：
1. 提问和回答处理
2. 问答历史显示
3. 游戏结束判断
4. 保持原有界面结构"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L274-L486 成功。发现当前getQwenAnswer函数代码如下：
async function getQwenAnswer(answer, question) {
    // 本地回答逻辑作为回退方案
    if (question.includes('是不是') || question.includes('是否')) {
        const target = question.replace(/是不是?/, '').replace('？', '');
        if (answer.includes(target)) {
            return '是';
        } else {
            return '不是';
        }
    } else {
        return '请以是不是问题提问';
    }
}
请修改此函数，实现真正的Qwen API调用，同时保持本地逻辑作为回退方案"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L488-L577 成功。发现当前getQwenHint函数代码如下：
async function getQwenHint(answer, question) {
    // 本地提示逻辑作为回退方案
    const hints = {
        // ...本地提示代码...
    };
    
    // 优先尝试Qwen API
    try {
        const token = process.env.QWEN_API_KEY;
        const response = await fetch('https://api.example.com/qwen/hint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                // ...Qwen API请求参数...
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return data.choices[0].message.content;
        } else {
            console.error('Qwen API错误:', data);
            // 回退到本地提示
            return hints[answer] || '请尝试其他问题';
        }
    } catch (error) {
        console.error('调用Qwen API错误:', error);
        // 回退到本地提示
        return hints[answer] || '请尝试其他问题';
    }
}
请优化此函数，确保提示内容简洁但有启发性"

### 阶段5：文档完善与部署指南

**用户输入**：
"查看文件:e:\Subject-Puzzle\README.md 成功。需要添加以下内容：
1. 大赛名称：大连理工大学第一届Vibe Coding Hackathon'灵码杯'
2. 赛题描述：游戏万物赛道
3. 项目创意：游戏作为知识传递载体
4. 运行与部署指南：所有需要npm install的依赖说明"

**用户输入**：
"查看文件:e:\Subject-Puzzle\README.md 成功。需要补充以下内容：
1. 与AI IDE的交互流程
2. 工具调用流程
3. 精确的文件定位示例
4. 明确的修改要求
5. 详细的错误处理要求
6. 用户体验优化指令"

**用户输入**：
"查看文件:e:\Subject-Puzzle\README.md 成功。需要更新以下内容：
1. 项目成果部分，突出Qwen API集成
2. 与AI协作的关键能力
3. 结论部分，强调AI使用能力
4. 完善安装步骤中所有需要npm install的依赖说明"

### 与AI IDE的协作模式

#### 1. 精确的文件定位

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L220-270"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L150-200"

**用户输入**：
"查看文件:e:\Subject-Puzzle\models\GameSession.js:L15-L18"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-304"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-319"

#### 2. 明确的修改要求

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 添加用户账号显示功能"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 添加检查用户登录状态的函数"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\routes\game.js 修改generateQwenPuzzle函数以使用真实的Qwen API"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\routes\game.js 更新开始游戏路由以支持关卡"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\models\GameSession.js 添加level字段"

#### 3. 详细的错误处理

**用户输入**：
"查看文件:e:\Subject-Puzzle\server.js:L0-57 成功。发现当前server.js中WebSocket连接处理代码如下：
// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');

  // 处理消息
  ws.on('message', (message) => {
    try {
        const data = JSON.parse(message);
        // ...消息处理代码...
    } catch (error) {
        console.error('消息处理错误:', error);
    }
});
请优化错误处理，添加更详细的错误信息和回退机制"

**用户输入**：
"查看文件:e:\Subject-Puzzle\routes\game.js:L488-L577 成功。发现当前getQwenHint函数错误处理如下：
} catch (error) {
    console.error('调用Qwen API错误:', error);
    // 回退到本地提示
    return hints[answer] || '请尝试其他问题';
}
请优化错误处理，添加更详细的错误分类和用户提示"

**用户输入**：
"查看文件:e:\Subject-Puzzle\game\level.html:L270-319 成功。发现当前submitAnswer函数错误处理如下：
} catch (error) {
    console.error('Submit answer error:', error);
    alert('提交失败，请检查网络连接');
}
请优化错误处理，区分网络错误、API错误和验证错误"

#### 4. 用户体验优化

**用户输入**：
"修改level.html文件，添加CSS样式以支持问题历史显示"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 添加问题历史记录的CSS样式"

**用户输入**：
"修改level.html文件，添加键盘回车支持"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 添加回车键事件绑定"

**用户输入**：
"修改level.html文件，添加游戏结束后的禁用状态"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 添加游戏结束后的按钮禁用逻辑"

#### 5. 与AI协作的关键能力

##### 精准的需求描述

**用户输入**：
"提供完整的Qwen API提示词设计，要求生成符合以下JSON格式的谜题：
{
  \"answer\": \"谜底\",
  \"soup\": \"汤面描述\",
  \"hint\": \"提示\",
  \"explanation\": \"谜底与汤面关系的简要说明\"
要求：
1. 学科由用户选择
2. 答案必须是真实存在的学科术语
3. 谜面要能通过提问逐步推理出答案
4. 提示要能帮助缩小范围但不直接透露答案
5. 答案长度3-10个字符"

##### 有效的代码管理

**用户输入**：
"编辑文件: e:\Subject-Puzzle\game\level.html 精确修改第270-304行代码，添加与后端API的交互功能，保持其余代码不变"

**用户输入**：
"修改routes/game.js文件，精确修改第274-486行getQwenAnswer函数，实现真正的Qwen API调用，保持原有路由结构"

**用户输入**：
"编辑文件: e:\Subject-Puzzle\models\GameSession.js 精确修改第15-18行，添加level字段，保持原有模型结构"

##### 问题诊断能力

**用户输入**：
"查看我之前回复的总结，level.html中的问题区域没有显示题目内容，应该如何修复？"

**用户输入**：
"查看我之前回复的总结，为什么获取提示路由没有正确更新提示内容？"

**用户输入**：
"查看我之前回复的总结，如何在不改变前端界面的情况下添加用户登录状态检查？"

##### 迭代优化能力

**用户输入**：
"优化Qwen回答函数，确保回答符合海龟汤游戏规则（只能回答是、不是、可能是、不确定）"

**用户输入**：
"增强Qwen API调用的错误处理，添加更完善的回退机制"

**用户输入**：
"提升游戏结束处理逻辑，区分胜利和失败状态，但不要改变前端界面"

##### 项目管理能力

**用户输入**：
"规划开发流程，优先级排序：
1. 修复用户账号显示
2. 实现题目内容显示
3. 完善Qwen API集成
4. 添加问题历史记录
5. 优化游戏结束处理"

**用户输入**：
"制定开发计划，平衡以下需求：
1. 不改变前端界面
2. 实现Qwen API集成
3. 保持原有路由结构
4. 添加新的数据库字段"

**用户输入**：
"制定优先级：
1. 修复关键功能（用户显示、题目显示）
2. 完善Qwen API集成
3. 优化错误处理
4. 增强用户体验"
