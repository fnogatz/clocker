const test = require('tape')
const Clocker = require('../lib/index')
const {initializeClocker} = require('./test-utils')

test('start', function (t) {
  t.plan(4)

  t.test('without arguments', function (t) {
    var clocker = initializeClocker()

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
      var clocker = initializeClocker()

      var date = new Date('2018-01-01')
      clocker.start(date, function (err, key) {
        t.notOk(err)
        t.ok(key, 'key is generated')

        clocker.close(function () {
          t.end()
        })
      })
    })

    t.test('as String', function (t) {
      var clocker = initializeClocker()

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
      var clocker = initializeClocker()

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
      var clocker = initializeClocker()

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
          var clocker = initializeClocker()
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
    var clocker = initializeClocker()

    var date = new Date('2018-01-01')
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
  t.plan(3)

  t.test('start+stop', function (t) {
    var clocker = initializeClocker()

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
    var clocker = initializeClocker()

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

  t.test('with given stamp', function (t) {
    var clocker = initializeClocker()

    clocker.status(function (err, status) {
      t.notOk(err)
      t.equal(status, 'stopped', 'stopped at first')

      clocker.start(function (_err, stamp) {
        clocker.status(stamp, function (err, status) {
          t.notOk(err)
          t.ok(/^elapsed time:/.test(status), 'started')

          clocker.stop(function () {
            clocker.status(stamp, function (err, status) {
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
})

test('stop', function (t) {
  t.plan(3)

  t.test('without arguments', function (t) {
    t.plan(2)

    t.test(function (t) {
      var clocker = initializeClocker()

      clocker.start('2 min ago', function (_err, stamp1) {
        clocker.start('1min ago', function (_err, stamp2) {
          clocker.status(stamp1, function (_err, status1) {
            clocker.status(stamp2, function (_err, status2) {
              t.ok(/^elapsed time:/.test(status1), 'first running')
              t.ok(/^elapsed time:/.test(status2), 'second running')

              clocker.stop(function (err) {
                t.notOk(err)

                clocker.status(stamp1, function (_err, status1) {
                  clocker.status(stamp2, function (_err, status2) {
                    t.ok(/^elapsed time:/.test(status1), 'first running')
                    t.equal(status2, 'stopped', 'second stopped')

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

    t.test('re-stop updates end time', function (t) {
      var clocker = initializeClocker()

      clocker.start('10 seconds ago', function (_err, stamp) {
        clocker.stop(function (err) {
          t.notOk(err)

          clocker.get(function (err, entry) {
            t.notOk(err)
            t.deepEqual(entry, mockup(stamp, {}, { end: entry.end }))
            t.equal(entry.elapsed, 10, '10 seconds elapsed')

            setTimeout(function () {
              clocker.stop(function (err) {
                t.notOk(err)

                clocker.get(function (err, entry) {
                  t.notOk(err)
                  t.deepEqual(entry, mockup(stamp, {}, { end: entry.end }))
                  t.equal(entry.elapsed, 12, '12 seconds elapsed')

                  clocker.close(function () {
                    t.end()
                  })
                })
              })
            }, 2000)
          })
        })
      })
    })
  })

  t.test('with stamp as argument', function (t) {
    t.plan(2)

    t.test(function (t) {
      var clocker = initializeClocker()

      clocker.start('2 min ago', function (_err, stamp1) {
        clocker.start('1min ago', function (_err, stamp2) {
          clocker.status(stamp1, function (_err, status1) {
            clocker.status(stamp2, function (_err, status2) {
              t.ok(/^elapsed time:/.test(status1), 'first running')
              t.ok(/^elapsed time:/.test(status2), 'second running')

              clocker.stop(stamp1, function (err) {
                t.notOk(err)

                clocker.status(stamp1, function (_err, status1) {
                  t.equal(status1, 'stopped', 'first stopped')

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

    t.test(function (t) {
      var clocker = initializeClocker()

      clocker.start('2 min ago', function (_err, stamp1) {
        clocker.start('1min ago', function (_err, stamp2) {
          clocker.status(stamp1, function (_err, status1) {
            clocker.status(stamp2, function (_err, status2) {
              t.ok(/^elapsed time:/.test(status1), 'first running')
              t.ok(/^elapsed time:/.test(status2), 'second running')

              clocker.stop(stamp2, function (err) {
                t.notOk(err)

                clocker.status(stamp2, function (_err, status1) {
                  t.equal(status1, 'stopped', 'second stopped')

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

  t.test('with data as parameter', function (t) {
    var clocker = initializeClocker()

    clocker.start({ some: 'thing' }, '1min ago', function (_err, stamp) {
      clocker.stop({ foo: 'bar' }, function (err) {
        t.notOk(err)

        clocker.get(stamp, function (_err, entry) {
          t.deepEqual(entry, mockup(stamp, {
            foo: 'bar',
            some: 'thing'
          }, {
            end: entry.end
          }))

          clocker.close(function () {
            t.end()
          })
        })
      })
    })
  })
})

test('get', function (t) {
  t.plan(4)

  t.test('without parameter', function (t) {
    var clocker = initializeClocker()

    clocker.start(function (_err, stamp) {
      clocker.get(function (err, entry) {
        t.notOk(err)
        t.deepEqual(entry, mockup(stamp))

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('Date as parameter', function (t) {
    var clocker = initializeClocker()

    var date1 = new Date('2018-01-01')
    var value1 = { foo: 'bar1' }

    var date2 = new Date('2018-02-02')
    var value2 = { foo: 'bar2' }

    clocker.start(value1, date1, function (_err, stamp1) {
      clocker.start(value2, date2, function (_err, stamp2) {
        clocker.get(date1, function (err, entry) {
          t.notOk(err)
          t.deepEqual(entry, mockup(stamp1, value1))

          clocker.get(date2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, mockup(stamp2, value2))

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('stamp as parameter', function (t) {
    var clocker = initializeClocker()

    var date1 = new Date('2018-01-01')
    var value1 = { foo: 'bar1' }
    var value2 = { foo: 'bar2' }

    clocker.start(value1, date1, function (_err, key1) {
      clocker.start(value2, function (_err, key2) {
        clocker.get(key1, function (err, entry) {
          t.notOk(err)
          t.deepEqual(entry, mockup(key1, value1))

          clocker.get(key2, function (err, entry) {
            t.notOk(err)

            t.deepEqual(entry, mockup(key2, value2))

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('get data object', function (t) {
    var clocker = initializeClocker()

    var data = {
      foo: 'bar',
      some: true
    }
    clocker.start(data, function (_err, key) {
      clocker.get(function (err, entry) {
        t.notOk(err)
        t.deepEqual(entry, mockup(key, data))

        clocker.close(function () {
          t.end()
        })
      })
    })
  })
})

test('set', function (t) {
  t.plan(4)

  t.test('with stamp argument', function (t) {
    t.plan(2)

    t.test('with key/value pair', function (t) {
      var clocker = initializeClocker()

      var data = {
        foo: 'bar',
        some: true
      }
      clocker.start(data, function (_err, stamp) {
        clocker.set(stamp, 'foo', 'boing', function (err) {
          t.notOk(err)

          clocker.get(stamp, function (err, data) {
            t.notOk(err)
            t.deepEqual(data, mockup(stamp, { foo: 'boing', some: true }))

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })

    t.test('with object', function (t) {
      var clocker = initializeClocker()

      var data = {
        foo: 'bar',
        some: true
      }
      clocker.start(data, function (_err, stamp) {
        clocker.set(stamp, { foo: 'boing' }, function (err) {
          t.notOk(err)

          clocker.get(stamp, function (err, data) {
            t.notOk(err)
            t.deepEqual(data, mockup(stamp, { foo: 'boing', some: true }))

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('without stamp argument', function (t) {
    var clocker = initializeClocker()

    var data = {
      foo: 'bar',
      some: true
    }
    clocker.start(data, function (_err, stamp) {
      clocker.set('foo', 'boing', function (err) {
        t.notOk(err)

        clocker.get(stamp, function (err, data) {
          t.notOk(err)
          t.deepEqual(data, mockup(stamp, { foo: 'boing', some: true }))

          clocker.close(function () {
            t.end()
          })
        })
      })
    })
  })

  t.test('special key: start', function (t) {
    var clocker = initializeClocker()

    var data = {
      foo: 'bar',
      some: true
    }
    clocker.start(data, function (_err, stamp1) {
      clocker.set(stamp1, 'start', '10 minutes ago', function (err, stamp2) {
        t.notOk(err)

        clocker.get(stamp2, function (err, data) {
          t.notOk(err)
          t.deepEqual(data, mockup(stamp2, { foo: 'bar', some: true }))

          clocker.close(function () {
            t.end()
          })
        })
      })
    })
  })

  t.test('special key: end', function (t) {
    var clocker = initializeClocker()

    var data = {
      foo: 'bar',
      some: true
    }
    clocker.start(data, '20 minutes ago', function (_err, stamp) {
      clocker.set(stamp, 'end', '10 minutes ago', function (err) {
        t.notOk(err)

        clocker.get(stamp, function (err, entry) {
          t.notOk(err)
          t.deepEqual(entry, mockup(stamp, { foo: 'bar', some: true }, { end: entry.end }))

          clocker.close(function () {
            t.end()
          })
        })
      })
    })
  })
})

test('restart', function (t) {
  var clocker = initializeClocker()

  var data = {
    foo: 'bar',
    some: true
  }
  clocker.start(data, function (_err, stamp1) {
    // wait a second to avoid restarting at the same time
    setTimeout(function () {
      clocker.restart(function (err, stamp2) {
        t.notOk(err)
        t.ok(stamp1 !== stamp2)

        clocker.get(stamp2, function (err, data2) {
          t.notOk(err)

          t.deepEqual(data2, mockup(stamp2, data))

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
    var clocker = initializeClocker()

    var start = new Date('2018-01-01')
    var stop = new Date('2018-01-02')
    clocker.add(start, stop, function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.get(stamp, function (err, data) {
        t.notOk(err)
        t.deepEqual(data, mockup(stamp, {}, { end: stop }))

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('String arguments', function (t) {
    var clocker = initializeClocker()

    clocker.add('yesterday 1:00', '2 minutes ago', function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.close(function () {
        t.end()
      })
    })
  })

  t.test('with data object given', function (t) {
    var clocker = initializeClocker()

    var data = {
      foo: 'bar',
      some: true
    }
    var end = new Date('2018-01-01')

    clocker.add('2 hours ago', end, data, function (err, stamp) {
      t.notOk(err)
      t.ok(stamp)

      clocker.get(stamp, function (err, data2) {
        t.notOk(err)
        t.deepEqual(data2, mockup(stamp, data, { end: end }))

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
    var clocker = initializeClocker()

    clocker.start(function (_err, stamp) {
      clocker.get(stamp, function (_err, entry) {
        t.ok(entry)

        clocker.remove(function (_err) {
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
    var clocker = initializeClocker()

    var date1 = new Date('2018-01-01')
    var date2 = new Date('2018-02-02')
    clocker.start(date1, function () {
      clocker.start(date2, function () {
        clocker.remove(date1, function (_err) {
          clocker.get(date1, function (err) {
            t.ok(err)

            clocker.get(date2, function (_err) {
              clocker.remove(date2, function (_err) {
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
    var clocker = initializeClocker()

    var date1 = new Date('2018-01-01')
    var date2 = new Date('2018-02-02')
    clocker.start(date1, function (_err, stamp1) {
      clocker.start(date2, function (_err, stamp2) {
        clocker.remove(stamp1, function (_err) {
          clocker.get(stamp1, function (_err) {
            clocker.get(stamp2, function (_err) {
              clocker.remove(stamp2, function (_err) {
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
    var clocker = initializeClocker()

    var value = {
      foo: 'bar'
    }
    clocker.start(value, '2 hours ago', function (_err, stamp) {
      clocker.data(function (err, data) {
        t.notOk(err)

        var reference = mockup(stamp, value)

        t.deepEqual(data, [ reference ])

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('empty object parameter', function (t) {
    var clocker = initializeClocker()

    var value = {
      foo: 'bar'
    }
    clocker.start(value, '2 hours ago', function (_err, stamp) {
      clocker.data({}, function (err, data) {
        t.notOk(err)

        var reference = mockup(stamp, value)

        t.deepEqual(data, [ reference ])

        clocker.close(function () {
          t.end()
        })
      })
    })
  })

  t.test('filter', function (t) {
    t.plan(3)

    t.test('gt', function (t) {
      t.plan(3)

      t.test(function (t) {
        var clocker = initializeClocker()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (_err, stamp) {
          clocker.data({ gt: '3 hours ago' }, function (err, data) {
            t.notOk(err)

            var reference = mockup(stamp, value)

            t.deepEqual(data, [ reference ])

            clocker.close(function () {
              t.end()
            })
          })
        })
      })

      t.test(function (t) {
        var clocker = initializeClocker()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (_err, stamp) {
          clocker.data({ gt: '1 hours ago' }, function (err, data) {
            t.notOk(err)

            t.deepEqual(data, [], 'empty result')

            clocker.close(function () {
              t.end()
            })
          })
        })
      })

      t.test(function (t) {
        var clocker = initializeClocker()

        var value = {
          foo: 'bar'
        }

        clocker.start(value, '2 hours ago', function (_err, stamp) {
          clocker.data({ gt: new Date(Date.now() - 3 * 60 * 60 * 1000) }, function (err, data) {
            t.notOk(err)

            var reference = mockup(stamp, value)

            t.deepEqual(data, [ reference ])

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
        var clocker = initializeClocker()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ lt: '1 hours ago' }, function (err, data) {
            t.notOk(err)

            var reference = mockup(stamp, value)

            t.deepEqual(data, [ reference ])

            clocker.close(function () {
              t.end()
            })
          })
        })
      })

      t.test(function (t) {
        var clocker = initializeClocker()

        var value = {
          foo: 'bar'
        }
        clocker.start(value, '2 hours ago', function (err, stamp) {
          t.notOk(err)

          clocker.data({ lt: '3 hours ago' }, function (err, data) {
            t.notOk(err)

            t.deepEqual(data, [], 'empty result')

            clocker.close(function () {
              t.end()
            })
          })
        })
      })
    })

    t.test('test', function (t) {
      var clocker = initializeClocker()

      clocker.add('08:00', '10:00', { type: 't1' }, function (_err, stamp1) {
        clocker.add('11:00', '13:00', { type: 't2' }, function (_err, stamp2) {
          clocker.data({
            test: (entry) => entry.data.type === 't1'
          }, function (err, data) {
            t.notOk(err)
            t.deepEqual(data, [ mockup(stamp1, { type: 't1' }, { end: data[0].end }) ])

            clocker.data({
              test: (entry) => entry.data.type === 't2'
            }, function (err, data) {
              t.notOk(err)
              t.deepEqual(data, [ mockup(stamp2, { type: 't2' }, { end: data[0].end }) ])

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

test('aggregate', function (t) {
  t.plan(2)

  t.test('by day', function (t) {
    t.plan(3)

    t.test('simple not overlapping days', function (t) {
      var clocker = initializeClocker()

      clocker.add('2018-01-01 08:00', '2018-01-01 10:00', { type: 't1' }, function (_err, stamp1) {
        clocker.add('2018-01-01 11:00', '2018-01-01 13:00', { type: 't2' }, function (_err, stamp2) {
          clocker.add('2018-01-02 14:00', '2018-01-02 16:00', { type: 't3' }, function (_err, stamp3) {
            clocker.aggregate('day', function (err, data) {
              t.notOk(err)
              t.deepEqual(data, {
                '2018-01-01': (2 + 2) * 60 * 60,
                '2018-01-02': 2 * 60 * 60
              })

              clocker.close(function () {
                t.end()
              })
            })
          })
        })
      })
    })

    t.test('overlapping days', function (t) {
      var clocker = initializeClocker()

      clocker.add('2018-01-01 08:00', '2018-01-01 09:00', { type: 't1' }, function (_err, stamp1) {
        clocker.add('2018-01-01 22:00', '2018-01-02 03:00', { type: 't2' }, function (_err, stamp2) {
          clocker.add('2018-01-02 14:00', '2018-01-02 18:00', { type: 't3' }, function (_err, stamp3) {
            clocker.aggregate('day', function (err, data) {
              t.notOk(err)
              t.deepEqual(data, {
                '2018-01-01': (1 + 2) * 60 * 60,
                '2018-01-02': (3 + 4) * 60 * 60
              })

              clocker.close(function () {
                t.end()
              })
            })
          })
        })
      })
    })

    t.test('overlapping days, multiple days', function (t) {
      var clocker = initializeClocker()

      clocker.add('2018-01-01 08:00', '2018-01-01 09:00', { type: 't1' }, function (_err, stamp1) {
        clocker.add('2018-01-01 22:00', '2018-01-03 03:00', { type: 't2' }, function (_err, stamp2) {
          clocker.add('2018-01-03 14:00', '2018-01-03 18:00', { type: 't3' }, function (_err, stamp3) {
            clocker.aggregate('day', function (err, data) {
              t.notOk(err)
              t.deepEqual(data, {
                '2018-01-01': (1 + 2) * 60 * 60,
                '2018-01-02': 24 * 60 * 60,
                '2018-01-03': (3 + 4) * 60 * 60
              })

              clocker.close(function () {
                t.end()
              })
            })
          })
        })
      })
    })
  })

  t.test('with filter', function (t) {
    t.plan(1)

    t.test('test for type', function (t) {
      var clocker = initializeClocker()

      clocker.add('2018-01-01 08:00', '2018-01-01 09:00', { type: 't1' }, function (_err, stamp1) {
        clocker.add('2018-01-01 11:00', '2018-01-01 13:00', { type: 't2' }, function (_err, stamp2) {
          clocker.add('2018-01-01 14:00', '2018-01-01 17:00', { type: 't1' }, function (_err, stamp3) {
            clocker.aggregate('day', {
              test: (entry) => entry.data.type === 't1'
            }, function (err, data) {
              t.notOk(err)
              t.deepEqual(data, {
                '2018-01-01': (1 + 3) * 60 * 60
              })

              clocker.aggregate('day', {
                test: (entry) => entry.data.type === 't2'
              }, function (err, data) {
                t.notOk(err)
                t.deepEqual(data, {
                  '2018-01-01': 2 * 60 * 60
                })

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

function mockup (stamp, value, obj) {
  obj = obj || {}
  obj.data = value || {}

  if (!obj.key) {
    obj.key = stamp
  }

  if (!obj.start && obj.key) {
    obj.start = new Date(obj.key * 1000)
  }

  obj.end = obj.end || 'NOW'

  obj.elapsed = Math.floor(((obj.end === 'NOW' ? new Date() : obj.end) - obj.start) / 1000)

  return obj
}
