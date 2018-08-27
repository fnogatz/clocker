var path = require('path')
var test = require('tape')
var rimraf = require('rimraf')
var strftime = require('strftime')

var Clocker = require('../lib/index')

test('start', function (t) {
  t.plan(4)

  t.test('without arguments', function (t) {
    var clocker = initialize()

    clocker.start(function (err, key) {
      t.notOk(err)
      t.ok(key, 'key is generated')

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('date given', function (t) {
    t.plan(2)

    t.test('as Date', function (t) {
      var clocker = initialize()

      var date = new Date()
      clocker.start(date, function (err, key) {
        t.notOk(err)
        t.ok(key, 'key is generated')

        clocker.close(function () {
          t.end()
        })
      })
    })

    t.test('as String', function (t) {
      var clocker = initialize()

      clocker.start('2 hours ago', function (err, key) {
        t.notOk(err)
        t.ok(key, 'key is generated')

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('data object given', function (t) {
    t.plan(3)

    t.test('with "type" property given', function (t) {
      var clocker = initialize()

      var data = {
        type: 'some'
      }
      clocker.start(data, function (err, key) {
        t.notOk(err)
        t.ok(key, 'key is generated')

        clocker.close(function () {
          t.end()
        })
      })
    })

    t.test('some data object given', function (t) {
      var clocker = initialize()

      var data = {
        foo: 'bar',
        other: 'some'
      }
      clocker.start(data, function (err, key) {
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

          clocker.start(obj, function (err) {
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
    clocker.start(data, date, function (err, key) {
      t.notOk(err)
      t.ok(key, 'key is generated')

      clocker.close(function () {
        t.end()
      })
    })
  })
})

test('status', function (t) {
  t.plan(2)

  t.test('start+stop', function (t) {
    var clocker = initialize()

    clocker.status(function (err, status) {
      t.notOk(err)
      t.equal(status, 'stopped', 'stopped at first')

      clocker.start(function () {
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

  t.test('correct output', function (t) {
    var clocker = initialize()

    clocker.start('2 hours ago', function () {
      clocker.status(function (err, status) {
        t.notOk(err)
        t.ok(/^elapsed time:/.test(status), 'started')
        t.ok(/^elapsed time: 02:00:0[01]$/.test(status), 'correct output')

        clocker.close(function () {
          t.end()
        })
      })
    })
  })
})

test('get', function (t) {
  t.plan(4)

  t.test('without parameter', function (t) {
    var clocker = initialize()

    clocker.start(function () {
      clocker.get(function (err, entry) {
        t.notOk(err)

        var emptyObject = {}
        t.deepEqual(entry, emptyObject)

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
    clocker.start({ foo: 'bar1' }, date1, function () {
      clocker.start({ foo: 'bar2' }, date2, function () {
        clocker.get(date1, function (err, entry) {
          t.notOk(err)

          t.deepEqual(entry, {
            foo: 'bar1'
          })

          clocker.get(date2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, {
              foo: 'bar2'
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
    clocker.start({ foo: 'bar1' }, date1, function (err, key1) {
      t.notOk(err)

      clocker.start({ foo: 'bar2' }, function (err, key2) {
        t.notOk(err)

        clocker.get(key1, function (err, entry) {
          t.notOk(err)

          t.deepEqual(entry, {
            foo: 'bar1'
          })

          clocker.get(key2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, {
              foo: 'bar2'
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
    clocker.start(data, function () {
      clocker.get(function (err, entry) {
        t.notOk(err)

        t.deepEqual(entry, {
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
  clocker.start(data, function (err, stamp1) {
    t.notOk(err)

    // wait a second to avoid restarting at the same time
    setTimeout(function () {
      clocker.restart(function (err, stamp2) {
        t.notOk(err)
        t.ok(stamp1 !== stamp2)

        clocker.get(stamp2, function (err, data2) {
          t.notOk(err)
          t.deepEqual(data2, {
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
    clocker.add(start, stop, function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('String arguments', function (t) {
    var clocker = initialize()

    clocker.add('yesterday 1:00', '2 minutes ago', function (err, stamp) {
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

    clocker.add('2 hours ago', end, data, function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.get(stamp, function (err, data2) {
        t.notOk(err)
        t.deepEqual(data2, {
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

test('remove', function (t) {
  t.plan(3)

  t.test('without parameter', function (t) {
    var clocker = initialize()

    clocker.start(function (err, stamp) {
      t.notOk(err)

      clocker.get(stamp, function (err, entry) {
        t.notOk(err)
        t.ok(entry)

        clocker.remove(function (err) {
          t.notOk(err)

          clocker.get(stamp, function (err, entry) {
            t.ok(err, 'stamp not found')

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('Date as parameter', function (t) {
    var clocker = initialize()

    var date1 = new Date('2018-01-01')
    var date2 = new Date('2018-02-02')
    clocker.start(date1, function () {
      clocker.start(date2, function () {
        clocker.remove(date1, function (err) {
          t.notOk(err)

          clocker.get(date1, function (err) {
            t.ok(err)

            clocker.get(date2, function (err) {
              t.notOk(err)

              clocker.remove(date2, function (err) {
                t.notOk(err)

                clocker.get(date2, function (err) {
                  t.ok(err)

                  clocker.close(function () {
                    t.end()
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  t.test('stamp as parameter', function (t) {
    var clocker = initialize()

    var date1 = new Date('2018-01-01')
    var date2 = new Date('2018-02-02')
    clocker.start(date1, function (err, stamp1) {
      t.notOk(err)

      clocker.start(date2, function (err, stamp2) {
        t.notOk(err)

        clocker.remove(stamp1, function (err) {
          t.notOk(err)

          clocker.get(stamp1, function (err) {
            t.ok(err)

            clocker.get(stamp2, function (err) {
              t.notOk(err)

              clocker.remove(stamp2, function (err) {
                t.notOk(err)

                clocker.get(stamp2, function (err) {
                  t.ok(err)

                  clocker.close(function () {
                    t.end()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

test('data', function (t) {
  t.plan(3)

  t.test('without parameter', function (t) {
    var clocker = initialize()

    var value = {
      foo: 'bar'
    }
    clocker.start(value, '2 hours ago', function (err, stamp) {
      t.notOk(err)

      clocker.data(function (err, data) {
        t.notOk(err)

        var reference = dataObject({
          key: stamp,
          value: value,
          start: new Date(stamp * 1000),
          end: 'NOW'
        })

        t.deepLooseEqual(data, [ reference ])

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('empty object parameter', function (t) {
    var clocker = initialize()

    var value = {
      foo: 'bar'
    }
    clocker.start(value, '2 hours ago', function (err, stamp) {
      t.notOk(err)

      clocker.data({}, function (err, data) {
        t.notOk(err)

        var reference = dataObject({
          key: stamp,
          value: value,
          start: new Date(stamp * 1000),
          end: 'NOW'
        })

        t.deepLooseEqual(data, [ reference ])

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('filter', function (t) {
    t.plan(2)

    t.test('gt', function (t) {
      t.plan(2)

      t.test(function (t) {
        var clocker = initialize()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ gt: '3 hours ago' }, function (err, data) {
            t.notOk(err)

            var reference = dataObject({
              key: stamp,
              value: value,
              start: new Date(stamp * 1000),
              end: 'NOW'
            })

            t.deepLooseEqual(data, [ reference ])

            clocker.close(function () {
              t.end()
            })
          })
        })
      })

      t.test(function (t) {
        var clocker = initialize()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ gt: '1 hours ago' }, function (err, data) {
            t.notOk(err)

            t.deepLooseEqual(data, [], 'empty result')

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })

    t.test('lt', function (t) {
      t.plan(2)

      t.test(function (t) {
        var clocker = initialize()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ lt: '1 hours ago' }, function (err, data) {
            t.notOk(err)

            var reference = dataObject({
              key: stamp,
              value: value,
              start: new Date(stamp * 1000),
              end: 'NOW'
            })

            t.deepLooseEqual(data, [ reference ])

            clocker.close(function () {
              t.end()
            })
          })
        })
      })

      t.test(function (t) {
        var clocker = initialize()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ lt: '3 hours ago' }, function (err, data) {
            t.notOk(err)

            t.deepLooseEqual(data, [], 'empty result')

            clocker.close(function () {
              t.end()
            })
          })
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

function dataObject (obj) {
  var end = obj.end || new Date()
  if (end === 'NOW') {
    end = new Date()
  }

  obj.elapsed = Math.floor((end - obj.start) / 1000)
  return obj
}
