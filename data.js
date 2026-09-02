(function (global) {
  'use strict';
  var STORAGE_KEY = 'errand_lite_data_v1';

  // ---- date helpers (build dynamic seed dates relative to "now") ----
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function isoAt(daysOffset, hour, minute) {
    var d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour != null ? hour : 12, minute != null ? minute : 0, 0, 0);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // full ISO timestamp (with seconds), used for postedAt / deliveredAt so
  // month-bucketing via .slice(0,7) works reliably
  function stampAt(daysOffset, hour, minute) {
    return isoAt(daysOffset, hour, minute) + ':00';
  }

  function seed() {
    var errands = [
      // ---- open (no runner yet) ----
      {
        id: 'e1', type: '取快递', pickupAddress: '菜鸟驿站(向阳小区南门)', dropoffAddress: '向阳小区3栋2单元502',
        reward: 15, deadline: isoAt(0, 19, 0), notes: '有两个快递，麻烦一起取。',
        customerName: '陈晨', customerPhone: '13800001001', postedAt: stampAt(0, 9, 10),
        status: 'open', runnerId: null, deliveredAt: null,
      },
      {
        id: 'e2', type: '代买', pickupAddress: '万达广场星巴克', dropoffAddress: '汇景大厦18楼1802',
        reward: 20, deadline: isoAt(0, 15, 30), notes: '一杯大杯拿铁，少冰。',
        customerName: '林悦', customerPhone: '13800001002', postedAt: stampAt(0, 10, 5),
        status: 'open', runnerId: null, deliveredAt: null,
      },
      // ---- accepted (in progress) ----
      {
        id: 'e3', type: '送文件', pickupAddress: '天恒科技园A座801', dropoffAddress: '市政务服务中心3号窗口',
        reward: 35, deadline: isoAt(1, 12, 0), notes: '合同原件，请轻拿轻放，务必当面签收。',
        customerName: '周涛', customerPhone: '13800001003', postedAt: stampAt(-1, 14, 20),
        status: 'accepted', runnerId: 'r2', deliveredAt: null,
      },
      {
        id: 'e4', type: '排队代办', pickupAddress: '车管所东门', dropoffAddress: '车管所东门',
        reward: 12, deadline: isoAt(0, 17, 0), notes: '帮忙排队取号，办理车辆年检，到号后电话通知我。',
        customerName: '黄敏', customerPhone: '13800001004', postedAt: stampAt(0, 8, 40),
        status: 'accepted', runnerId: 'r4', deliveredAt: null,
      },
      // ---- delivered (completed, contributes to runner totals) ----
      {
        id: 'e5', type: '取快递', pickupAddress: '顺丰驿站(建设路店)', dropoffAddress: '锦绣花园7栋1单元1201',
        reward: 18, deadline: isoAt(-1, 18, 0), notes: '',
        customerName: '吴芳', customerPhone: '13800001005', postedAt: stampAt(-2, 9, 0),
        status: 'delivered', runnerId: 'r1', deliveredAt: stampAt(-1, 17, 40),
      },
      {
        id: 'e6', type: '送文件', pickupAddress: '弘毅律师事务所', dropoffAddress: '高新区法院立案庭',
        reward: 26, deadline: isoAt(0, 11, 0), notes: '起诉材料，需要当天送达。',
        customerName: '赵磊', customerPhone: '13800001006', postedAt: stampAt(-1, 8, 30),
        status: 'delivered', runnerId: 'r1', deliveredAt: stampAt(0, 10, 15),
      },
      {
        id: 'e7', type: '代买', pickupAddress: '同仁堂药店(人民路店)', dropoffAddress: '阳光小区5栋601',
        reward: 22, deadline: isoAt(0, 20, 0), notes: '感冒药，处方照片已通过电话发送给药店。',
        customerName: '孙丽', customerPhone: '13800001007', postedAt: stampAt(0, 9, 50),
        status: 'delivered', runnerId: 'r2', deliveredAt: stampAt(0, 13, 25),
      },
      {
        id: 'e8', type: '排队代办', pickupAddress: '不动产登记中心', dropoffAddress: '不动产登记中心',
        reward: 30, deadline: isoAt(-15, 16, 0), notes: '代排号办理产权证明打印。',
        customerName: '刘洋', customerPhone: '13800001008', postedAt: stampAt(-16, 9, 0),
        status: 'delivered', runnerId: 'r3', deliveredAt: stampAt(-15, 15, 50),
      },
    ];

    var runners = [
      { id: 'r1', name: '张伟', phone: '13900002001' },
      { id: 'r2', name: '李娜', phone: '13900002002' },
      { id: 'r3', name: '王强', phone: '13900002003' },
      { id: 'r4', name: '赵敏', phone: '13900002004' },
    ];

    return { errands: errands, runners: runners };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var s = seed();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        return s;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.errands || !parsed.runners) throw new Error('bad shape');
      return parsed;
    } catch (e) {
      var s2 = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s2));
      return s2;
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---- derived runner stats: NEVER trust a stored counter, always compute
  // from the Errand records so the numbers can't drift out of sync ----
  function runnerStats(data, runnerId) {
    var completed = data.errands.filter(function (e) {
      return e.runnerId === runnerId && e.status === 'delivered';
    });
    var totalEarned = completed.reduce(function (sum, e) { return sum + Number(e.reward || 0); }, 0);
    return { totalCompleted: completed.length, totalEarned: totalEarned };
  }

  global.ErrandData = {
    load: load,
    save: save,
    uid: uid,
    runnerStats: runnerStats,
    reset: function () { var s = seed(); save(s); return s; },
  };
})(window);
