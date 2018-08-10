var path = require('path')
var test = require('tape')
var rimraf = require('rimraf')

var Clocker = require('../lib/index')

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
