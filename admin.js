(function () {
  'use strict';

  var data = ErrandData.load();

  var STATUS_LABEL = { open: '待接单', accepted: '进行中', delivered: '已送达', cancelled: '已取消' };

  var sideLinks = document.querySelectorAll('.side-link[data-view]');
  var views = document.querySelectorAll('.admin-view');

  function switchView(name) {
    data = ErrandData.load(); // always work from the freshest state when entering a view
    sideLinks.forEach(function (l) { l.classList.toggle('active', l.dataset.view === name); });
    views.forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'dashboard') renderDashboard();
    if (name === 'hall') renderHall();
    if (name === 'runners') renderRunners();
    if (name === 'orders') renderOrders();
  }

  sideLinks.forEach(function (l) {
    l.addEventListener('click', function () { switchView(l.dataset.view); });
  });

  document.getElementById('btnResetData').addEventListener('click', function () {
    if (!confirm('确定要重置成示例数据吗？这会清空你新增/修改的所有内容。')) return;
    data = ErrandData.reset();
    switchView('dashboard');
  });

  function runnerName(id) {
    if (!id) return '-';
    var r = data.runners.find(function (x) { return x.id === id; });
    return r ? r.name : '（跑腿员已删除）';
  }

  function fmt(ts) {
    if (!ts) return '';
    return ts.replace('T', ' ').slice(0, 16);
  }

  // ---------- Dashboard ----------
  function currentYearMonth() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  function renderDashboard() {
    var total = data.errands.length;
    var openCount = data.errands.filter(function (e) { return e.status === 'open'; }).length;
    var acceptedCount = data.errands.filter(function (e) { return e.status === 'accepted'; }).length;

    var ym = currentYearMonth();
    var monthPayout = data.errands
      .filter(function (e) { return e.status === 'delivered' && e.deliveredAt && e.deliveredAt.slice(0, 7) === ym; })
      .reduce(function (sum, e) { return sum + Number(e.reward || 0); }, 0);

    var stats = [
      { label: '跑腿订单总数', value: total },
      { label: '待接单', value: openCount },
      { label: '进行中', value: acceptedCount },
      { label: '本月已送达总收入', value: '¥' + monthPayout },
    ];
    document.getElementById('statGrid').innerHTML = stats.map(function (s) {
      return '<div class="stat-card"><div class="num">' + s.value + '</div><div class="label">' + s.label + '</div></div>';
    }).join('');

    var rows = data.runners.map(function (r) {
      var stat = ErrandData.runnerStats(data, r.id);
      return { name: r.name, totalCompleted: stat.totalCompleted, totalEarned: stat.totalEarned };
    }).sort(function (a, b) { return b.totalEarned - a.totalEarned; });

    document.getElementById('leaderboardBody').innerHTML = rows.map(function (row) {
      return '<tr class="leaderboard-row"><td>' + row.name + '</td><td>' + row.totalCompleted + ' 单</td><td>¥' + row.totalEarned + '</td></tr>';
    }).join('') || '<tr><td colspan="3" style="color:var(--muted)">暂无跑腿员</td></tr>';
  }

  // ---------- 接单大厅 (Hall) ----------
  var hallMsg = document.getElementById('hallMsg');
  function showHallMsg(text, isError) {
    hallMsg.innerHTML = '<div class="msg ' + (isError ? 'error' : 'success') + '">' + text + '</div>';
  }

  function errandCardHtml(e, actionsHtml) {
    return '<div class="errand-card" data-id="' + e.id + '">' +
      '<div class="errand-card__top">' +
      '<span class="errand-card__type">' + e.type + '</span>' +
      '<span class="badge ' + e.status + '">' + STATUS_LABEL[e.status] + '</span>' +
      '</div>' +
      '<div class="errand-card__addr"><span class="from">取</span>' + e.pickupAddress + '</div>' +
      '<div class="errand-card__addr"><span class="to">送</span>' + e.dropoffAddress + '</div>' +
      '<div class="errand-card__meta">悬赏 ¥' + e.reward + ' · 期望完成 ' + fmt(e.deadline) + '</div>' +
      '<div class="errand-card__meta">客户：' + e.customerName + '（' + e.customerPhone + '）' + (e.runnerId ? ' · 跑腿员：' + runnerName(e.runnerId) : '') + '</div>' +
      (actionsHtml ? '<div class="errand-card__actions">' + actionsHtml + '</div>' : '') +
      '</div>';
  }

  function renderHall() {
    var runnerOptions = '<option value="">请选择跑腿员</option>' + data.runners.map(function (r) {
      return '<option value="' + r.id + '">' + r.name + '</option>';
    }).join('');

    var openErrands = data.errands.filter(function (e) { return e.status === 'open'; });
    document.getElementById('openList').innerHTML = openErrands.map(function (e) {
      var actions = '<select class="assign-select">' + runnerOptions + '</select> ' +
        '<button class="btn btn-sm btn-primary" data-assign="' + e.id + '">指派/接单</button>';
      return errandCardHtml(e, actions);
    }).join('') || '<p style="color:var(--muted);font-size:13px">暂无待接单的订单。</p>';

    var acceptedErrands = data.errands.filter(function (e) { return e.status === 'accepted'; });
    document.getElementById('acceptedList').innerHTML = acceptedErrands.map(function (e) {
      var actions = '<button class="btn btn-sm" data-deliver="' + e.id + '">标记已送达</button>';
      return errandCardHtml(e, actions);
    }).join('') || '<p style="color:var(--muted);font-size:13px">暂无进行中的订单。</p>';

    document.querySelectorAll('[data-assign]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.errand-card');
        var select = card.querySelector('.assign-select');
        assignRunner(btn.dataset.assign, select.value);
      });
    });
    document.querySelectorAll('[data-deliver]').forEach(function (btn) {
      btn.addEventListener('click', function () { markDelivered(btn.dataset.deliver); });
    });
  }

  function assignRunner(errandId, runnerId) {
    if (!runnerId) { showHallMsg('请先选择要指派的跑腿员。', true); return; }
    // re-check FRESH state right before writing: another admin/runner session
    // may have already grabbed this order since the list was rendered
    data = ErrandData.load();
    var e = data.errands.find(function (x) { return x.id === errandId; });
    if (!e) { showHallMsg('该订单不存在，可能已被删除。', true); renderHall(); return; }
    if (e.status !== 'open') {
      showHallMsg('指派失败：该订单已不是"待接单"状态（可能已被其他人抢先接单），已为你刷新最新状态。', true);
      renderHall();
      return;
    }
    var r = data.runners.find(function (x) { return x.id === runnerId; });
    if (!r) { showHallMsg('该跑腿员不存在，可能已被删除。', true); renderHall(); return; }

    e.runnerId = runnerId;
    e.status = 'accepted';
    ErrandData.save(data);
    showHallMsg('已成功指派 ' + r.name + ' 接单，订单转为进行中。', false);
    renderHall();
  }

  function markDelivered(errandId) {
    data = ErrandData.load();
    var e = data.errands.find(function (x) { return x.id === errandId; });
    if (!e) { showHallMsg('该订单不存在，可能已被删除。', true); renderHall(); return; }
    if (e.status !== 'accepted') {
      showHallMsg('操作失败：该订单当前不是"进行中"状态，无法标记已送达。', true);
      renderHall();
      return;
    }
    e.status = 'delivered';
    e.deliveredAt = new Date().toISOString();
    ErrandData.save(data);
    showHallMsg('订单已标记为已送达。', false);
    renderHall();
  }

  // ---------- 我的跑腿员 (Runners) ----------
  var runnerModalBackdrop = document.getElementById('runnerModalBackdrop');
  var runnerModalTitle = document.getElementById('runnerModalTitle');
  var runnerModalMsg = document.getElementById('runnerModalMsg');
  var runnerForm = document.getElementById('runnerForm');
  var runnerIdInput = document.getElementById('runnerIdInput');
  var runnerNameInput = document.getElementById('runnerNameInput');
  var runnerPhoneInput = document.getElementById('runnerPhoneInput');

  function renderRunners() {
    document.getElementById('runnersBody').innerHTML = data.runners.map(function (r) {
      var stat = ErrandData.runnerStats(data, r.id);
      return '<tr><td>' + r.name + '</td><td>' + r.phone + '</td><td>' + stat.totalCompleted + ' 单</td><td>¥' + stat.totalEarned + '</td>' +
        '<td class="table-actions">' +
        '<button class="btn btn-sm" data-edit="' + r.id + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-delete="' + r.id + '">删除</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--muted)">暂无跑腿员</td></tr>';

    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openRunnerModal(btn.dataset.edit); });
    });
    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteRunner(btn.dataset.delete); });
    });
  }

  function openRunnerModal(id) {
    runnerModalMsg.innerHTML = '';
    runnerForm.reset();
    if (id) {
      var r = data.runners.find(function (x) { return x.id === id; });
      runnerModalTitle.textContent = '编辑跑腿员';
      runnerIdInput.value = r.id;
      runnerNameInput.value = r.name;
      runnerPhoneInput.value = r.phone;
    } else {
      runnerModalTitle.textContent = '新增跑腿员';
      runnerIdInput.value = '';
    }
    runnerModalBackdrop.classList.add('show');
  }

  document.getElementById('btnAddRunner').addEventListener('click', function () { openRunnerModal(null); });
  document.getElementById('btnCloseRunnerModal').addEventListener('click', function () { runnerModalBackdrop.classList.remove('show'); });
  runnerModalBackdrop.addEventListener('click', function (e) { if (e.target === runnerModalBackdrop) runnerModalBackdrop.classList.remove('show'); });

  runnerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = runnerNameInput.value.trim();
    var phone = runnerPhoneInput.value.trim();
    if (!name || !phone) {
      runnerModalMsg.innerHTML = '<div class="msg error">请完整填写姓名和手机号。</div>';
      return;
    }

    data = ErrandData.load();
    var id = runnerIdInput.value;
    if (id) {
      var r = data.runners.find(function (x) { return x.id === id; });
      if (r) { r.name = name; r.phone = phone; }
    } else {
      data.runners.push({ id: ErrandData.uid('r'), name: name, phone: phone });
    }
    ErrandData.save(data);
    runnerModalBackdrop.classList.remove('show');
    renderRunners();
  });

  function deleteRunner(id) {
    if (!confirm('确定删除这名跑腿员吗？已关联的历史订单会保留，但会显示"跑腿员已删除"。')) return;
    data = ErrandData.load();
    data.runners = data.runners.filter(function (r) { return r.id !== id; });
    ErrandData.save(data);
    renderRunners();
  }

  // ---------- 订单管理 (Orders) ----------
  var currentFilter = 'all';
  document.querySelectorAll('#orderFilters .filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentFilter = btn.dataset.status;
      document.querySelectorAll('#orderFilters .filter-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderOrders();
    });
  });

  function renderOrders() {
    var list = currentFilter === 'all' ? data.errands : data.errands.filter(function (e) { return e.status === currentFilter; });
    list = list.slice().sort(function (a, b) { return b.postedAt < a.postedAt ? -1 : 1; });
    document.getElementById('ordersBody').innerHTML = list.map(function (e) {
      return '<tr><td>' + e.type + '</td><td>' + e.pickupAddress + '</td><td>' + e.dropoffAddress + '</td><td>¥' + e.reward + '</td>' +
        '<td>' + e.customerName + '</td><td>' + runnerName(e.runnerId) + '</td>' +
        '<td><span class="badge ' + e.status + '">' + STATUS_LABEL[e.status] + '</span></td></tr>';
    }).join('') || '<tr><td colspan="7" style="color:var(--muted)">暂无订单</td></tr>';
  }

  switchView('dashboard');
})();
