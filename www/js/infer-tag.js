(function (global) {
  'use strict';

  const MODULES = [
    '信息收集', '目标管理', '目标分解', '生产要素组织',
    '岗位设置', '会务组织', '计划控制', '质量控制',
    '成本控制', '市场控制', '内部协调与控制', '外部协调与控制'
  ];

  function inferTag(question) {
    if (question && question.moduleId) {
      const n = Number(question.moduleId.replace('m', ''));
      if (n >= 1 && n <= 12) return { id: question.moduleId, name: MODULES[n - 1] };
    }
    const id = question && question.id ? question.id : 1;
    const idx = Math.floor((id - 1) / 4);
    return { id: 'm' + String(idx + 1).padStart(2, '0'), name: MODULES[idx] || '未知模块' };
  }

  global.AgriTag = { MODULES, inferTag };
})(window);
