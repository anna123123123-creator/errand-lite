(function () {
  'use strict';

  var postForm = document.getElementById('postForm');
  var postMsg = document.getElementById('postMsg');
  var typeInput = document.getElementById('typeInput');
  var pickupInput = document.getElementById('pickupInput');
  var dropoffInput = document.getElementById('dropoffInput');
  var rewardInput = document.getElementById('rewardInput');
  var deadlineInput = document.getElementById('deadlineInput');
  var notesInput = document.getElementById('notesInput');
  var customerNameInput = document.getElementById('customerNameInput');
  var customerPhoneInput = document.getElementById('customerPhoneInput');

  var lookupPhoneInput = document.getElementById('lookupPhoneInput');
  var btnLookup = document.getElementById('btnLookup');
  var lookupMsg = document.getElementById('lookupMsg');
  var myErrands = document.getElementById('myErrands');

  var data = ErrandData.load();

  var STATUS_LABEL = { open: '待接单', accepted: '进行中', delivered: '已送达', cancelled: '已取消' };

  function runnerName(id) {
    if (!id) return '';
    var r = data.runners.find(function (x) { return x.id === id; });
    return r ? r.name : '（跑腿员已删除）';
  }

  function fmt(ts) {
    if (!ts) return '';
    return ts.replace('T', ' ').slice(0, 16);
  }

  function showPostMsg(text, isError) {
    postMsg.innerHTML = '<div class="msg ' + (isError ? 'error' : 'success') + '">' + text + '</div>';
  }

  function showLookupMsg(text, isError) {
    lookupMsg.innerHTML = text ? '<div class="msg ' + (isError ? 'error' : 'success') + '">' + text + '</div>' : '';
  }

  postForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var type = typeInput.value;
    var pickup = pickupInput.value.trim();
    var dropoff = dropoffInput.value.trim();
    var reward = parseFloat(rewardInput.value);
    var deadline = deadlineInput.value;
    var notes = notesInput.value.trim();
    var customerName = customerNameInput.value.trim();
    var customerPhone = customerPhoneInput.value.trim();

    if (!pickup) return showPostMsg('请填写取件地址。', true);
    if (!dropoff) return showPostMsg('请填写送达地址。', true);
    if (!(reward > 0)) return showPostMsg('请填写大于 0 的悬赏金额。', true);
    if (!deadline) return showPostMsg('请选择期望完成时间。', true);
    if (!customerName) return showPostMsg('请填写你的姓名。', true);
    if (!customerPhone) return showPostMsg('请填写你的手机号。', true);

    var errand = {
      id: ErrandData.uid('e'),
      type: type,
      pickupAddress: pickup,
      dropoffAddress: dropoff,
      reward: reward,
      deadline: deadline,
      notes: notes,
      customerName: customerName,
      customerPhone: customerPhone,
      postedAt: new Date().toISOString(),
      status: 'open',
      runnerId: null,
      deliveredAt: null,
    };
    data.errands.push(errand);
    ErrandData.save(data);

    showPostMsg('跑腿需求已发布，等待跑腿员接单。', false);
    postForm.reset();

    // convenience: immediately show it in the lookup panel below
    lookupPhoneInput.value = customerPhone;
    renderMyErrands(customerPhone);
  });

  function renderMyErrands(phone) {
    data = ErrandData.load();
    if (!phone) {
      showLookupMsg('请输入手机号查询。', true);
      myErrands.innerHTML = '';
      return;
    }
    var list = data.errands.filter(function (e) { return e.customerPhone === phone; })
      .slice()
      .sort(function (a, b) { return b.postedAt < a.postedAt ? -1 : 1; });

    if (!list.length) {
      showLookupMsg('没有找到该手机号下的跑腿订单。', true);
      myErrands.innerHTML = '';
      return;
    }
    showLookupMsg('找到 ' + list.length + ' 条跑腿订单。', false);
    myErrands.innerHTML = list.map(function (e) {
      var runnerLine = e.runnerId ? '<div class="errand-card__meta">跑腿员：' + runnerName(e.runnerId) + '</div>' : '';
      return '<div class="errand-card">' +
        '<div class="errand-card__top">' +
        '<span class="errand-card__type">' + e.type + '</span>' +
        '<span class="badge ' + e.status + '">' + STATUS_LABEL[e.status] + '</span>' +
        '</div>' +
        '<div class="errand-card__addr"><span class="from">取</span>' + e.pickupAddress + '</div>' +
        '<div class="errand-card__addr"><span class="to">送</span>' + e.dropoffAddress + '</div>' +
        '<div class="errand-card__meta">悬赏 ¥' + e.reward + ' · 期望完成 ' + fmt(e.deadline) + '</div>' +
        runnerLine +
        (e.notes ? '<div class="errand-card__meta">备注：' + e.notes + '</div>' : '') +
        '</div>';
    }).join('');
  }

  btnLookup.addEventListener('click', function () {
    renderMyErrands(lookupPhoneInput.value.trim());
  });
  lookupPhoneInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); renderMyErrands(lookupPhoneInput.value.trim()); }
  });
})();
