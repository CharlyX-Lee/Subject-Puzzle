// 显示加载状态
function showLoading() {
    // 如果有加载元素，可以在这里添加显示逻辑
    console.log('Loading...');
}

// 隐藏加载状态
function hideLoading() {
    // 如果有加载元素，可以在这里添加隐藏逻辑
    console.log('Loading finished');
}

// 显示错误信息
function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
}

// 显示成功信息
function showSuccess(message) {
    const successElement = document.getElementById('success');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
}

// 获取所有用户
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            window.location.href = 'login.html';
            return;
        }

        showLoading();
        
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            displayUsers(data);
        } else {
            showError(data.message || '获取用户列表失败');
        }
    } catch (error) {
        console.error('获取用户列表失败:', error);
        showError('网络错误，请稍后重试');
    } finally {
        hideLoading();
    }
}

// 显示用户列表
function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    if (users.length === 0) {
        usersList.innerHTML = '<tr><td colspan="6">暂无用户</td></tr>';
        return;
    }
    
    // 获取当前登录用户信息
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // 检查是否为当前登录用户
        const isCurrentUser = currentUser.id === user._id;
        
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <select class="role-select" data-user-id="${user._id}" ${isCurrentUser ? 'disabled' : ''} onchange="updateUserRole('${user._id}', this.value)">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>普通用户</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
                </select>
                ${isCurrentUser ? '<span style="font-size: 12px; color: #999;">(自己)</span>' : ''}
            </td>
            <td>${user.score || 0}</td>
            <td>${new Date(user.createdAt).toLocaleString()}</td>
            <td>
                ${isCurrentUser ? '' : `<button onclick="deleteUser('${user._id}')" class="delete-btn">删除</button>`}
            </td>
        `;
        usersList.appendChild(row);
    });
}

// 更新用户角色
async function updateUserRole(userId, role) {
    // 如果是当前用户，需要确认
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (userId === currentUser.id) {
        showError('不能修改自己的角色');
        // 重置选择框到之前的状态
        const selectElements = document.querySelectorAll(`.role-select[data-user-id="${userId}"]`);
        selectElements.forEach(select => {
            // 找到之前选中的选项
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                if (option.selected) {
                    select.value = option.value;
                }
            });
        });
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('用户角色更新成功');
            loadUsers(); // 刷新用户列表
        } else {
            showError(data.message || '更新用户角色失败');
            // 重置选择框到之前的状态
            const selectElements = document.querySelectorAll(`.role-select[data-user-id="${userId}"]`);
            selectElements.forEach(select => {
                // 找到之前选中的选项
                const options = select.querySelectorAll('option');
                options.forEach(option => {
                    if (option.selected) {
                        select.value = option.value;
                    }
                });
            });
        }
    } catch (error) {
        showError('网络错误，请稍后重试');
        // 重置选择框到之前的状态
        const selectElements = document.querySelectorAll(`.role-select[data-user-id="${userId}"]`);
        selectElements.forEach(select => {
            // 找到之前选中的选项
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                if (option.selected) {
                    select.value = option.value;
                }
            });
        });
    }
}

// 删除用户
async function deleteUser(userId) {
    if (!confirm('确定要删除该用户吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('用户删除成功');
            loadUsers(); // 刷新用户列表
        } else {
            showError(data.message || '删除用户失败');
        }
    } catch (error) {
        showError('网络错误，请稍后重试');
    }
}

// 获取所有房间
async function fetchRooms() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            window.location.href = 'login.html';
            return;
        }

        showLoading();
        
        const response = await fetch('/api/admin/rooms', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            displayRooms(data);
        } else {
            showError(data.message || '获取房间列表失败');
        }
    } catch (error) {
        console.error('获取房间列表失败:', error);
        showError('网络错误，请稍后重试');
    } finally {
        hideLoading();
    }
}

// 显示房间列表
function displayRooms(rooms) {
    const roomsList = document.getElementById('roomsList');
    if (!roomsList) return;
    
    roomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<p>暂无房间</p>';
        return;
    }
    
    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <div class="room-info">
                <h3>房间名称: ${room.name}</h3>
                <p>创建者: ${room.creator?.username || '未知'}</p>
                <p>玩家数量: ${room.players?.length || 0}/${room.maxPlayers}</p>
                <p>状态: ${room.status === 'waiting' ? '等待中' : room.status === 'playing' ? '游戏中' : '已结束'}</p>
                <p>创建时间: ${new Date(room.createdAt).toLocaleString()}</p>
            </div>
            <div class="room-actions">
                <button onclick="deleteRoom('${room._id}')" class="delete-btn">删除房间</button>
            </div>
        `;
        roomsList.appendChild(roomElement);
    });
}

// 删除房间
async function deleteRoom(roomId) {
    if (!confirm('确定要删除这个房间吗？')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        showLoading();
        
        const response = await fetch(`/api/admin/rooms/${roomId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            showSuccess('房间删除成功');
            fetchRooms(); // 刷新房间列表
        } else {
            showError(data.message || '删除房间失败');
        }
    } catch (error) {
        console.error('删除房间失败:', error);
        showError('网络错误，请稍后重试');
    } finally {
        hideLoading();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    // 显示管理员名称
    const adminNameElement = document.getElementById('adminName');
    if (adminNameElement) {
        adminNameElement.textContent = user.username;
    }
    
    // 绑定退出登录按钮事件
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
    
    // 绑定刷新统计按钮事件
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', loadStats);
    }
    
    // 绑定刷新用户列表按钮事件
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', loadUsers);
    }
    
    // 绑定房间标签点击事件
    const roomsTab = document.getElementById('roomsTab');
    if (roomsTab) {
        roomsTab.addEventListener('click', fetchRooms);
    }
    
    // 默认加载用户列表
    loadUsers();
    
    // 加载统计信息
    loadStats();
});

// 加载统计信息
async function loadStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }
        
        // 获取用户统计
        const usersResponse = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (usersResponse.ok) {
            const users = await usersResponse.json();
            const totalUsersElement = document.getElementById('totalUsers');
            if (totalUsersElement) {
                totalUsersElement.textContent = users.length;
            }
            
            // 统计管理员数量
            const adminCount = users.filter(user => user.role === 'admin').length;
            const adminUsersElement = document.getElementById('adminUsers');
            if (adminUsersElement) {
                adminUsersElement.textContent = adminCount;
            }
        }
        
        // 获取房间统计
        const roomsResponse = await fetch('/api/admin/rooms', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (roomsResponse.ok) {
            const rooms = await roomsResponse.json();
            const totalGamesElement = document.getElementById('totalGames');
            if (totalGamesElement) {
                totalGamesElement.textContent = rooms.length;
            }
            
            // 统计进行中的游戏
            const activeGamesCount = rooms.filter(room => room.status === 'playing').length;
            const activeGamesElement = document.getElementById('activeGames');
            if (activeGamesElement) {
                activeGamesElement.textContent = activeGamesCount;
            }
        }
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 切换标签页
function showTab(tabName) {
    // 隐藏所有标签内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有标签按钮的活动状态
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // 显示选中的标签内容
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 设置选中标签按钮的活动状态
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // 如果是房间标签，加载房间数据
    if (tabName === 'rooms') {
        fetchRooms();
    }
}