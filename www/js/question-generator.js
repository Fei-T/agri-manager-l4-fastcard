(function (global) {
  'use strict';

  function byKind(ctx, kind, moduleId) {
    return ctx.questions.items.filter(it =>
      it.kind === kind && (!moduleId || it.moduleId === moduleId)
    );
  }

  function allKinds(ctx, moduleId) {
    return ['fillBlank', 'choice', 'trueFalse', 'order'].map(k => ({
      kind: k,
      items: byKind(ctx, k, moduleId)
    }));
  }

  function label(kind) {
    return { fillBlank: '填空', choice: '选择', trueFalse: '判断', order: '排序' }[kind] || kind;
  }

  global.AgriQuestions = { byKind, allKinds, label };
})(window);
