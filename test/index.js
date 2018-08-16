var path = require('path')
var test = require('tape')
var rimraf = require('rimraf')
var strftime = require('strftime')

var Clocker = require('../lib/index')

test('start', function (t) {
  t.plan(6)

  t.test('throws for missing type', function (t) {
    var clocker = initialize()

    t.throws(function () {
      clocker.start()
    })

    clocker.close(function () {
      t.end()
    })
  })

  t.test('returns error for missing type', function (t) {
    var clocker = initialize()

    clocker.start(function (err, key) {
      t.ok(err, 'error is set')

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('no date given', function (t) {
    var clocker = initialize()

    clocker.start('some', function (err, key) {
      t.notOk(err)
      t.ok(key, 'key is generated')

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('date given', function (t) {
    var clocker = initialize()

    var date = new Date()
    clocker.start('some', date, function (err, key) {
      t.notOk(err)
      t.ok(key, 'key is generated')

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('data object given', function (t) {
    t.plan(2)

    t.test(function (t) {
      var clocker = initialize()

      var data = {
        foo: 'bar'
      }
      clocker.start('some', data, function (err, key) {
        t.notOk(err)
        t.ok(key, 'key is generated')

        clocker.close(function () {
          t.end()
        })
      })
    })

    t.test('throws for reserved keywords', function (t) {
      var reservedWords = Clocker.RESERVED_DATA_ENTRIES

      t.plan(reservedWords.length)

      reservedWords.forEach(function (reserved) {
        t.test('key "' + reserved + '" not allowed', function (t) {
          var clocker = initialize()
          var obj = {}
          obj[reserved] = true

          clocker.start('some', obj, function (err) {
            t.ok(err)

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('date and data object given', function (t) {
    var clocker = initialize()

    var date = new Date()
    var data = {
      foo: 'bar'
    }
    clocker.start('some', date, data, function (err, key) {
      t.notOk(err)
      t.ok(key, 'key is generated')

      clocker.close(function () {
        t.end()
      })
    })
  })
})

test('status', function (t) {
  var clocker = initialize()

  clocker.status(function (err, status) {
    t.notOk(err)
    t.equal(status, 'stopped', 'stopped at first')

    clocker.start('some', function () {
      clocker.status(function (err, status) {
        t.notOk(err)
        t.ok(/^elapsed time:/.test(status), 'started')

        clocker.stop(function () {
          clocker.status(function (err, status) {
            t.notOk(err)
            t.equal(status, 'stopped', 'stopped again')

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })
})

test('get', function (t) {
  t.plan(4)

  t.test('without parameter', function (t) {
    var clocker = initialize()

    clocker.start('some', function () {
      clocker.get(function (err, entry) {
        t.notOk(err)

        t.deepEqual(entry, {
          type: 'some'
        })

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('Date as parameter', function (t) {
    var clocker = initialize()

    var date1 = new Date('2018-01-01')
    var date2 = new Date('2018-02-02')
    clocker.start('some1', date1, function () {
      clocker.start('some2', date2, function () {
        clocker.get(date1, function (err, entry) {
          t.notOk(err)

          t.deepEqual(entry, {
            type: 'some1'
          })

          clocker.get(date2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, {
              type: 'some2'
            })

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('stamp as parameter', function (t) {
    var clocker = initialize()

    var date1 = new Date('2018-01-01')
    clocker.start('some1', date1, function (err, key1) {
      t.notOk(err)

      clocker.start('some2', function (err, key2) {
        t.notOk(err)

        clocker.get(key1, function (err, entry) {
          t.notOk(err)

          t.deepEqual(entry, {
            type: 'some1'
          })

          clocker.get(key2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, {
              type: 'some2'
            })

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('get data object', function (t) {
    var clocker = initialize()

    var data = {
      foo: 'bar',
      some: true
    }
    clocker.start('some', data, function () {
      clocker.get(function (err, entry) {
        t.notOk(err)

        t.deepEqual(entry, {
          type: 'some',
          foo: 'bar',
          some: true
        })

        clocker.close(function () {
          t.end()
        })
      })
    })
  })
})

test('restart', function (t) {
  var clocker = initialize()

  var data = {
    foo: 'bar',
    some: true
  }
  clocker.start('some', data, function (err, stamp1) {
    t.notOk(err)

    // wait a second to avoid restarting at the same time
    setTimeout(function () {
      clocker.restart(function (err, stamp2) {
        t.notOk(err)
        t.ok(stamp1 !== stamp2)

        clocker.get(stamp2, function (err, data2) {
          t.notOk(err)
          t.deepEqual(data2, {
            type: 'some',
            foo: 'bar',
            some: true
          })

          clocker.close(function () {
            t.end()
          })
        })
      })
    }, 1000)
  })
})

test('add', function (t) {
  t.plan(3)

  t.test('Date arguments', function (t) {
    var clocker = initialize()

    var start = new Date('2018-01-01')
    var stop = new Date('2018-01-02')
    clocker.add(start, stop, 'some', function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('String arguments', function (t) {
    var clocker = initialize()

    clocker.add('yesterday 1:00', '2 minutes ago', 'some', function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('with data object given', function (t) {
    var clocker = initialize()

    var data = {
      foo: 'bar',
      some: true
    }
    var end = new Date()
    var endValue = strftime('%F %T', end)

    clocker.add('2 hours ago', end, 'some', data, function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.get(stamp, function (err, data2) {
        t.notOk(err)
        t.deepEqual(data2, {
          type: 'some',
          foo: 'bar',
          some: true,
          end: endValue
        })

        clocker.close(function () {
          t.end()
        })
      })
    })
  })
})

function initialize () {
  var dataDir = path.join(__dirname, 'datadir')

  // Empty db dir
  rimraf.sync(path.join(dataDir, 'db'))

  // Initialize clocker
  var clocker = new Clocker({
    dir: dataDir
  })

  return clocker
}
