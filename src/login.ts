import { invoke } from "@tauri-apps/api/core";

let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
let remainingTimeInterval: number | null = null;

function formatRemainingTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时${minutes}分钟${secs}秒`;
}

function updateRemainingTime(seconds: number) {
    const authError = document.getElementById('auth-error');
    const timeDisplay = document.getElementById('time-display');
    
    if (seconds <= 0) {
        if (authError) {
            authError.textContent = '许可证已过期，请输入新的卡密';
            authError.style.color = '#dc3545';
            authError.style.fontWeight = 'bold';
        }
        if (timeDisplay) {
            timeDisplay.textContent = '许可证已过期';
            timeDisplay.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
            timeDisplay.style.color = 'white';
            timeDisplay.style.fontWeight = 'bold';
        }
        if (remainingTimeInterval) {
            clearInterval(remainingTimeInterval);
            remainingTimeInterval = null;
        }
        return;
    }
    
    const timeText = `剩余使用时间：${formatRemainingTime(seconds)}`;
    if (authError) {
        authError.textContent = timeText;
        authError.style.color = '#4CAF50';
        authError.style.fontWeight = 'normal';
    }
    if (timeDisplay) {
        timeDisplay.textContent = timeText;
        timeDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        timeDisplay.style.color = 'white';
        timeDisplay.style.fontWeight = 'normal';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        isDarkMode = savedTheme === 'dark';
        document.body.classList.toggle('dark-theme', isDarkMode);
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-theme', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

async function checkAuth() {
    const authInput = document.getElementById('auth-input') as HTMLInputElement;
    const authError = document.getElementById('auth-error');
    const authSubmit = document.getElementById('auth-submit') as HTMLButtonElement;
    
    if (!authInput || !authError || !authSubmit) return;
    
    const input = authInput.value;
    
    try {
        const response = await invoke<{
            success: boolean;
            remaining_attempts: number;
            should_exit: boolean;
            remaining_time: number | null;
            card_type: string | null;
        }>("check_auth", { password: input });
        
        if (response.success && response.remaining_time && response.card_type) {
            // 禁用输入框和按钮
            authInput.disabled = true;
            authSubmit.disabled = true;
            authInput.style.backgroundColor = '#f5f5f5';
            authSubmit.style.backgroundColor = '#cccccc';
            authSubmit.style.cursor = 'not-allowed';
            
            // 清除之前的定时器
            if (remainingTimeInterval) {
                clearInterval(remainingTimeInterval);
            }
            
            // 保存卡类型和开始时间到localStorage
            localStorage.setItem('card_type', response.card_type);
            localStorage.setItem('start_time', Date.now().toString());
            
            // 显示成功消息
            authError.textContent = '许可证有效，请等待，即将跳转...';
            authError.style.color = '#4CAF50';
            
            // 2秒后跳转到主页面
            setTimeout(() => {
                window.location.hash = '#/show';
            }, 2000);
        } else {
            if (response.remaining_attempts > 0) {
                authError.textContent = `密码错误，还剩 ${response.remaining_attempts} 次机会`;
                authError.style.color = '#dc3545';
            } else {
                authError.textContent = '错误次数过多，程序即将退出';
                authError.style.color = '#dc3545';
                authError.style.fontWeight = 'bold';
                // 禁用输入框和按钮
                authInput.disabled = true;
                authSubmit.disabled = true;
                authInput.style.backgroundColor = '#f5f5f5';
                authSubmit.style.backgroundColor = '#cccccc';
                authSubmit.style.cursor = 'not-allowed';
            }
            authInput.value = ''; // 清空输入框
        }
    } catch (error) {
        console.error('验证失败:', error);
        // 显示具体的错误信息
        authError.textContent = `验证失败: ${error}`;
        authError.style.color = '#dc3545';
        authError.style.fontWeight = 'bold';
    }
}

// 检查是否已有有效的许可证
async function checkExistingLicense() {
    try {
        const response = await invoke<{
            success: boolean;
            remaining_attempts: number;
            should_exit: boolean;
            remaining_time: number | null;
            card_type: string | null;
        }>("verify_license");

        if (response.success && response.remaining_time && response.card_type) {
            const authInput = document.getElementById('auth-input') as HTMLInputElement;
            const authSubmit = document.getElementById('auth-submit') as HTMLButtonElement;
            
            if (authInput && authSubmit) {
                // 禁用输入框和按钮
                authInput.disabled = true;
                authSubmit.disabled = true;
                authInput.style.backgroundColor = '#f5f5f5';
                authSubmit.style.backgroundColor = '#cccccc';
                authSubmit.style.cursor = 'not-allowed';
            }
            
            // 清除之前的定时器
            if (remainingTimeInterval) {
                clearInterval(remainingTimeInterval);
            }
            
            // 保存卡类型和开始时间到localStorage
            localStorage.setItem('card_type', response.card_type);
            localStorage.setItem('start_time', Date.now().toString());
            
            // 设置剩余时间更新定时器
            let remainingSeconds = response.remaining_time;
            updateRemainingTime(remainingSeconds);
            
            remainingTimeInterval = window.setInterval(() => {
                remainingSeconds--;
                if (remainingSeconds <= 0) {
                    if (remainingTimeInterval) {
                        clearInterval(remainingTimeInterval);
                        remainingTimeInterval = null;
                    }
                    // 显示过期提示
                    const authError = document.getElementById('auth-error');
                    if (authError) {
                        authError.textContent = '许可证已过期，请输入新的卡密';
                        authError.style.color = '#dc3545';
                        authError.style.fontWeight = 'bold';
                    }
                    // 5秒后跳转到登录页
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 5000);
                } else {
                    updateRemainingTime(remainingSeconds);
                }
            }, 1000);
            
            // 显示成功消息
            const authError = document.getElementById('auth-error');
            if (authError) {
                authError.textContent = '许可证有效，请等待，即将跳转...';
                authError.style.color = '#4CAF50';
            }
            
            // 5秒后跳转到主页面
            setTimeout(() => {
                window.location.hash = '#/show';
            }, 5000);
        } else {
            // 许可证无效或不存在，清除存储的信息
            localStorage.removeItem('card_type');
            localStorage.removeItem('start_time');
            if (remainingTimeInterval) {
                clearInterval(remainingTimeInterval);
                remainingTimeInterval = null;
            }
            // 显示过期提示
            const authError = document.getElementById('auth-error');
            if (authError) {
                authError.textContent = '许可证已过期，请输入新的卡密';
                authError.style.color = '#dc3545';
                authError.style.fontWeight = 'bold';
            }
        }
    } catch (error) {
        console.error('检查许可证失败:', error);
        // 发生错误时，清除存储的信息
        localStorage.removeItem('card_type');
        localStorage.removeItem('start_time');
        if (remainingTimeInterval) {
            clearInterval(remainingTimeInterval);
            remainingTimeInterval = null;
        }
        // 显示具体的错误信息
        const authError = document.getElementById('auth-error');
        if (authError) {
            authError.textContent = `许可证验证失败: ${error}`;
            authError.style.color = '#dc3545';
            authError.style.fontWeight = 'bold';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    initTheme();
    
    // 检查现有许可证
    checkExistingLicense();
    
    // 添加主题切换按钮
    const themeToggle = document.createElement('div');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = `
        <button id="theme-toggle-btn" class="theme-btn">
            ${isDarkMode ? '☀️' : '🌙'}
        </button>
    `;
    document.body.appendChild(themeToggle);
    
    // 添加时间显示元素
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'time-display';
    timeDisplay.className = 'time-display';
    document.body.appendChild(timeDisplay);
    
    // 添加验证相关事件监听
    const authInput = document.getElementById('auth-input') as HTMLInputElement;
    const authSubmit = document.getElementById('auth-submit');
    
    if (authSubmit) {
        authSubmit.addEventListener('click', () => checkAuth());
    }
    
    if (authInput) {
        authInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkAuth();
            }
        });
    }

    // 添加主题切换按钮事件监听
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
});
