#!/usr/bin/env node

var path = require('path')
var program = require('commander')
var strftime = require('strftime')
var Clocker = require('../lib/index')

program
  .version(require('../package.json').version)
  .description('track project hours')

program
  .command('start')
  .description('start the clock')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(start)

program
  .command('list')
  .alias('ls')
  .description('show data entries')
  .option('-d, --datadir <path>')
  .option('-v, --verbose', 'also show clocked messages')
  .action(list)

var argvs = splitArgvs(process.argv)

program.parse(argvs[0])

function splitArgvs (argv) {
  // splits array on '--' value into array of arrays
  return argv.reduceRight((prev, curr) => {
    if (curr === '--') {
      prev.unshift([])
    } else {
      prev[0].unshift(curr)
    }
    return prev
  }, [[]])
}

function start (cmd) {
  var clocker = initialize(cmd)

  var data = {}
  ;['type', 'message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  if (argvs[1]) {
    argvs[1].forEach(function (prop) {
      prop = prop.trimLeft('-')
      var [key, value] = prop.split('=')
      data[key] = value
    })
  }

  clocker.start(data, new Date(), started)
}

function list (cmd) {
  var clocker = initialize(cmd)

  clocker.dataStream({}).on('error', function (err) {
    console.log(err)
    process.exit(1)
  }).on('end', function () {
    process.exit(0)
  }).on('data', function (entry) {
    printEntry(entry)

    if (cmd.verbose) {
      printMessage(entry.data.message)
    }
  })
}

function initialize (cmd) {
  return new Clocker({
    dir: dir(cmd)
  })
}

function dir (cmd) {
  if (cmd.datadir) {
    return cmd.datadir
  }

  var HOME = process.env.HOME || process.env.USERPROFILE
  var defaultDataDir = path.join(HOME, '.clocker2')
  return defaultDataDir
}

function started (err, stamp) {
  if (err) {
    console.log(err)
    return process.exit(1)
  }

  console.log('Started: ' + stamp)
  process.exit(0)
}

function printEntry (entry) {
  var data = entry.data || {}

  console.log(
    '%s  %s  [ %s - %s ]  (%s)%s%s',
    entry.key,
    strftime('%F', entry.start),
    strftime('%T', entry.start),
    (entry.end === 'NOW' ? 'NOW' : strftime('%T', entry.end)),
    Clocker.formatElapsed(entry.elapsed),
    (data.type ? '  [' + data.type + ']' : ''),
    (data.archive ? ' A' : '')
  )
}

function printMessage (message) {
  if (message) {
    var lines = message.split('\n')
    console.log()
    lines.forEach(function (line) {
      console.log('    ' + line)
    })
    console.log()
  }
}
