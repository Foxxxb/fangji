import { invoke } from "@tauri-apps/api/core";

interface Prescription {
  方名: string;
  组成: string;
  用法: string;
  功用: string;
  主治: string;
  证治机理: string;
  方解: string;
  运用: string;
  附方: string;
  鉴别: string;
  方论选录: string;
  医案举例: string;
  方歌: string;
}

interface PrescriptionTree {
  name: string;
  children: string[];
}

let prescriptions: Prescription[] = [];
let tree: PrescriptionTree | null = null;
let selected: Prescription | null = null;
let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
let isComparing = false;
let comparingPrescriptions: Prescription[] = [];
let searchResults: { prescription: Prescription; matches: { field: string; text: string; matchText: string }[] }[] = [];
let isSearchMode = false;
let currentSearchText = '';
let remainingTimeInterval: number | null = null;

function highlightText(text: string, searchText: string): string {
  if (!searchText) return text;
  const regex = new RegExp(`(${searchText})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function toggleSearchMode() {
  isSearchMode = !isSearchMode;
  const searchSubmit = document.getElementById('search-submit');
  if (searchSubmit) {
    searchSubmit.textContent = isSearchMode ? '退出搜索模式' : '搜索';
  }

  if (!isSearchMode) {
    // 退出搜索模式时，清除高亮
    searchResults = [];
    renderDetail();
    // 清除左侧树状结构的高亮
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
      node.classList.remove('search-match');
    });
  } else if (currentSearchText) {
    // 进入搜索模式时，如果有搜索文本，重新执行搜索
    searchPrescriptions(currentSearchText);
  }
}

function searchPrescriptions(searchText: string) {
  currentSearchText = searchText;
  if (!searchText.trim()) {
    searchResults = [];
    renderDetail();
    return;
  }

  searchResults = prescriptions.map(prescription => {
    const matches: { field: string; text: string; matchText: string }[] = [];
    Object.entries(prescription).forEach(([field, value]) => {
      const lowerValue = value.toLowerCase();
      const lowerSearchText = searchText.toLowerCase();
      if (lowerValue.includes(lowerSearchText)) {
        matches.push({ 
          field, 
          text: value,
          matchText: searchText
        });
      }
    });
    return { prescription, matches };
  }).filter(result => result.matches.length > 0);

  renderSearchResults();
}

function renderSearchResults() {
  const detailEl = document.getElementById("detail");
  if (!detailEl) return;

  if (searchResults.length === 0) {
    detailEl.innerHTML = '<div style="text-align:center;color:#888;">未找到匹配结果</div>';
    return;
  }

  const displayOrder = [
    '方名',
    '功用',
    '主治',
    '组成',
    '用法',
    '方解',
    '运用',
    '鉴别',
    '证治机理',
    '附方',
    '方论选录',
    '医案举例',
    '方歌'
  ] as const;

  const resultsHtml = searchResults.map(result => {
    const { prescription, matches } = result;
    const highlightedFields = displayOrder.map(field => {
      let value = prescription[field];
      // 处理方歌字段
      if (field === '方歌') {
        value = cleanFangge(value);
      }
      const match = matches.find(m => m.field === field);
      const displayValue = match ? highlightText(value, match.matchText) : value;
      return `<tr>
        <th>${field}</th>
        <td>${displayValue.split('\n').join('<br>')}</td>
      </tr>`;
    }).join('');

    return `
      <div class="search-result-item">
        <h3 class="search-result-title">${prescription.方名}</h3>
        <table class="prescription-table">
          <tbody>
            ${highlightedFields}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  detailEl.innerHTML = `
    <div class="search-results">
      <div class="search-results-header">找到 ${searchResults.length} 个匹配结果</div>
      ${resultsHtml}
    </div>
  `;

  // 高亮左侧树状结构中的匹配项
  const treeNodes = document.querySelectorAll('.tree-node');
  treeNodes.forEach(node => {
    const name = node.textContent;
    const isMatch = searchResults.some(r => r.prescription.方名 === name);
    node.classList.toggle('search-match', isMatch);
  });
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-theme', isDarkMode);
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDarkMode = savedTheme === 'dark';
    document.body.classList.toggle('dark-theme', isDarkMode);
  }
}

function toggleCompare() {
  isComparing = !isComparing;
  const compareBtn = document.getElementById('compare-btn');
  if (compareBtn) {
    compareBtn.textContent = isComparing ? '已选好' : '对比';
    compareBtn.classList.toggle('comparing', isComparing);
  }
  
  const detailPanel = document.getElementById('detail');
  if (detailPanel) {
    detailPanel.classList.toggle('comparing', isComparing);
  }

  if (!isComparing && comparingPrescriptions.length >= 2) {
    renderComparison();
  } else if (!isComparing) {
    comparingPrescriptions = [];
    renderDetail();
  }

  // 每次进入对比模式时，清除所有选中状态
  if (isComparing) {
    comparingPrescriptions = [];
    const treeNodes = document.querySelectorAll('.tree-node');
    treeNodes.forEach(node => {
      node.classList.remove('selected-for-compare');
    });
  }
}

function addToComparison(prescription: Prescription) {
  if (!isComparing) return;
  
  const existingIndex = comparingPrescriptions.findIndex(p => p.方名 === prescription.方名);
  const treeNodes = document.querySelectorAll('.tree-node');
  
  if (existingIndex === -1) {
    // 如果未选中，则添加到对比列表
    comparingPrescriptions.push(prescription);
    treeNodes.forEach(node => {
      if (node.textContent === prescription.方名) {
        node.classList.add('selected-for-compare');
      }
    });
  } else {
    // 如果已选中，则从对比列表中移除
    comparingPrescriptions.splice(existingIndex, 1);
    treeNodes.forEach(node => {
      if (node.textContent === prescription.方名) {
        node.classList.remove('selected-for-compare');
      }
    });
  }
}

function compareStrings(str1: string, str2: string): { text: string; matches: number[] } {
  const result = { text: str1, matches: [] as number[] };
  const chars1 = str1.split('');
  const chars2 = str2.split('');
  
  // 创建字符位置映射
  const charMap = new Map<string, number[]>();
  chars2.forEach((char, index) => {
    if (!charMap.has(char)) {
      charMap.set(char, []);
    }
    charMap.get(char)!.push(index);
  });
  
  // 查找匹配
  for (let i = 0; i < chars1.length - 1; i++) {
    const char1 = chars1[i];
    const char2 = chars1[i + 1];
    const pair = char1 + char2;
    
    // 跳过标点符号
    if (/[，。、；：""""''（）【】《》？！]/.test(pair)) continue;
    
    // 跳过数字或中文字符与符号的组合
    if (/[\d\u4e00-\u9fa5][，。、；：""""''（）【】《》？！]/.test(pair) || 
        /[，。、；：""""''（）【】《》？！][\d\u4e00-\u9fa5]/.test(pair)) continue;
    
    // 跳过括号、数字、空格和"两"字
    if (/[()（）]/.test(pair) || /\d/.test(pair) || /\s/.test(pair) || /两/.test(pair)) continue;
    
    // 在第二个字符串中查找这个字符对
    for (let j = 0; j < chars2.length - 1; j++) {
      if (chars2[j] === char1 && chars2[j + 1] === char2) {
        result.matches.push(i, i + 1);
        break;
      }
    }
  }
  
  return result;
}

function cleanFangge(fangge: string): string {
  const pos = fangge.indexOf('。');
  if (pos !== -1) {
    return fangge.slice(0, pos + 1);
  }
  return fangge;
}

function renderComparison() {
  const detailEl = document.getElementById("detail");
  if (!detailEl) return;

  const displayOrder = [
    '方名',
    '功用',
    '主治',
    '组成',
    '用法',
    '方解',
    '运用',
    '鉴别',
    '证治机理',
    '附方',
    '方论选录',
    '医案举例',
    '方歌'
  ] as const;

  const tableRows = displayOrder.map(key => {
    const cells = comparingPrescriptions.map((p, index) => {
      let content = p[key];
      
      // 对功用、主治、组成字段进行对比高亮
      if ((key === '功用' || key === '主治' || key === '组成'|| key === '证治机理'|| key === '运用') && comparingPrescriptions.length > 1) {
        const allMatches = new Set<number>();
        
        // 与所有其他方剂进行对比
        comparingPrescriptions.forEach((otherP, otherIndex) => {
          if (index !== otherIndex) {
            const comparison = compareStrings(p[key], otherP[key]);
            comparison.matches.forEach(match => allMatches.add(match));
          }
        });
        
        // 应用高亮
        const chars = content.split('');
        content = chars.map((char, i) => 
          allMatches.has(i) ? `<mark>${char}</mark>` : char
        ).join('');
      }

      // 处理方解字段的特殊高亮
      if (key === '方解') {
        // 先与组成字段进行对比并加粗匹配内容
        const composition = p['组成'];
        const comparison = compareStrings(content, composition);
        const chars = content.split('');
        // 生成加粗后的内容，确保两个字符两个字符地匹配
        let result = '';
        for (let i = 0; i < chars.length; i++) {
          if (comparison.matches.includes(i) && comparison.matches.includes(i + 1)) {
            result += `<strong>${chars[i]}${chars[i + 1]}</strong>`;
            i++; // 跳过下一个字符，因为已经处理过了
          } else {
            result += chars[i];
          }
        }
        content = result;

        // 然后进行君臣佐使的高亮
        content = content.replace(/君/g, '<span style="color: red">君</span>')
                        .replace(/臣/g, '<span style="color: blue">臣</span>')
                        .replace(/佐/g, '<span style="color: #00ff00">佐</span>')
                        .replace(/使/g, '<span style="color: #00ff00">使</span>');
      }

      // 处理方歌字段
      if (key === '方歌') {
        content = cleanFangge(content);
      }
      
      return `<td class="compare-cell">${content.split('\n').join('<br>')}</td>`;
    }).join('');
    return `<tr><th>${key}</th>${cells}</tr>`;
  });

  detailEl.innerHTML = `
    <table class="prescription-table compare-table">
      <thead>
        <tr>
          <th></th>
          ${comparingPrescriptions.map(p => `<th class="compare-header">${p.方名}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tableRows.join('')}
      </tbody>
    </table>
  `;
}

function renderTree() {
  const treeEl = document.getElementById("tree");
  if (!treeEl || !tree) return;
  treeEl.innerHTML = `<div class="tree-root">${tree.name}</div>` +
    '<ul>' +
    tree.children.map(
      (name) => `<li class="tree-node" data-name="${name}">${name}</li>`
    ).join("") +
    '</ul>';
  
  // 绑定点击事件
  treeEl.querySelectorAll('.tree-node').forEach((el) => {
    el.addEventListener('click', (e) => {
      const name = (e.target as HTMLElement).dataset.name;
      const found = prescriptions.find((p) => p.方名 === name);
      if (found) {
        if (isComparing) {
          addToComparison(found);
        } else {
          selected = found;
          renderDetail();
        }
      }
    });
  });
}

function renderDetail() {
  const detailEl = document.getElementById("detail");
  if (!detailEl) return;
  if (!selected) {
    detailEl.innerHTML = '<div style="text-align:center;color:#888;">请选择左侧方剂</div>';
    return;
  }
  
  const displayOrder = [
    '方名',
    '功用',
    '主治',
    '组成',
    '用法',
    '方解',
    '运用',
    '鉴别',
    '证治机理',
    '附方',
    '方论选录',
    '医案举例',
    '方歌'
  ] as const;

  const tableRows = displayOrder.map(key => {
    let value = selected![key];
    
    // 处理方解字段的特殊高亮
    if (key === '方解') {
      // 先进行君臣佐使的高亮
      value = value.replace(/君/g, '<span style="color: red">君</span>')
                  .replace(/臣/g, '<span style="color: blue">臣</span>')
                  .replace(/佐/g, '<span style="color: #00ff00">佐</span>')
                  .replace(/使/g, '<span style="color: #00ff00">使</span>');

      // 与组成字段进行匹配并高亮
      const composition = selected!['组成'];
      const comparison = compareStrings(value, composition);
      const chars = value.split('');
      // 生成高亮后的内容，确保两个字符两个字符地匹配
      let result = '';
      for (let i = 0; i < chars.length; i++) {
        if (comparison.matches.includes(i) && comparison.matches.includes(i + 1)) {
          result += `<strong>${chars[i]}${chars[i + 1]}</strong>`;
          i++; // 跳过下一个字符，因为已经处理过了
        } else {
          result += chars[i];
        }
      }
      value = result;
    }
    
    // 处理方歌字段
    if (key === '方歌') {
      value = cleanFangge(value);
    }
    
    return `<tr><th>${key}</th><td>${value.split('\n').join('<br>')}</td></tr>`;
  });

  detailEl.innerHTML = `
    <table class="prescription-table">
      <tbody>
        ${tableRows.join('')}
      </tbody>
    </table>
  `;
}

async function loadData() {
  const result = await invoke("get_prescriptions");
  // @ts-ignore
  tree = result.tree;
  // @ts-ignore
  prescriptions = result.data;
  renderTree();
  selected = null;
  renderDetail();
}

function formatRemainingTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时${minutes}分钟${secs}秒`;
}

function updateRemainingTime() {
    const cardType = localStorage.getItem('card_type');
    const startTime = localStorage.getItem('start_time');
    
    if (!cardType || !startTime) {
        window.location.href = 'index.html';
        return;
    }
    
    const startTimeNum = parseInt(startTime);
    const now = Date.now();
    const duration = {
        'day': 24 * 60 * 60 * 1000,
        'week': 7 * 24 * 60 * 60 * 1000,
        'month': 30 * 24 * 60 * 60 * 1000
    }[cardType] || 0;
    
    const remainingMs = duration - (now - startTimeNum);
    if (remainingMs <= 0) {
        if (remainingTimeInterval) {
            clearInterval(remainingTimeInterval);
            remainingTimeInterval = null;
        }
        localStorage.removeItem('card_type');
        localStorage.removeItem('start_time');
        window.location.href = 'index.html';
        return;
    }
    
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const timeDisplay = document.getElementById('remaining-time');
    if (timeDisplay) {
        timeDisplay.textContent = `剩余使用时间：${formatRemainingTime(remainingSeconds)}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
  // 初始化主题
  initTheme();
  
  // 检查许可证
  const cardType = localStorage.getItem('card_type');
  const startTime = localStorage.getItem('start_time');
  if (!cardType || !startTime) {
      window.location.href = 'index.html';
      return;
  }
  
  // 添加剩余时间显示
  const header = document.querySelector('.header');
  if (header) {
      const timeDisplay = document.createElement('div');
      timeDisplay.id = 'remaining-time';
      timeDisplay.className = 'remaining-time';
      header.appendChild(timeDisplay);
      
      // 立即更新一次时间
      updateRemainingTime();
      
      // 设置定时更新
      remainingTimeInterval = window.setInterval(updateRemainingTime, 1000);
  }
  
  // 添加主题切换按钮事件监听
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
  
  // 添加对比按钮事件监听
  document.getElementById('compare-btn')?.addEventListener('click', toggleCompare);
  
  // 添加搜索相关事件监听
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchSubmit = document.getElementById('search-submit');
  
  searchSubmit?.addEventListener('click', () => {
    if (isSearchMode) {
      toggleSearchMode();
    } else {
      searchPrescriptions(searchInput.value);
      toggleSearchMode();
    }
  });

  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (isSearchMode) {
        toggleSearchMode();
      } else {
        searchPrescriptions(searchInput.value);
        toggleSearchMode();
      }
    }
  });

  // 点击搜索按钮时聚焦到输入框
  document.getElementById('search-btn')?.addEventListener('click', () => {
    searchInput?.focus();
  });
  
  // 加载数据
  loadData();
});
