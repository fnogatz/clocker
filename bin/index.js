#!/usr/bin/env node

var path = require('path')
var program = require('commander')
var strftime = require('strftime')
var Clocker = require('../lib/index')

var argvs = splitArgvs(process.argv)

program
  .version(require('../package.json').version)
  .description('track project hours')

// Show info on unknown command
program.on('command:*', function () {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', argvs[0].slice(2).join(' '))
  process.exit(1)
})

// Adjust help output for set command
//   as it has two optional arguments,
//   which cannot be handled by commander
var outputHelp = program.outputHelp.bind(program)
program.outputHelp = function (cb) {
  cb = cb || function (passthru) { return passthru }
  var newCb = function (text) {
    return cb(text).replace('set [options] [stamp] <key> [value]', 'set [options] [stamp] <key> <value>')
  }
  outputHelp(newCb)
}

program
  .command('start')
  .description('start the clock')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(start)

program
  .command('stop [stamp]')
  .description('stop the clock')
  .option('-d, --datadir <path>')
  .option('-m, --message <value>')
  .action(stop)

program
  .command('restart [stamp]')
  .description('restart the clock')
  .option('-d, --datadir <path>')
  .action(restart)

program
  .command('status [stamp]')
  .description('show the elapsed time')
  .option('-d, --datadir <path>')
  .action(status)

program
  .command('list')
  .alias('ls')
  .description('show data entries')
  .option('-d, --datadir <path>')
  .option('-v, --verbose', 'also show clocked messages')
  .action(list)

program
  .command('get [stamp]')
  .description('get the raw data')
  .option('-d, --datadir <path>')
  .action(get)

program
  .command('set [stamp] <key> [value]')
  .usage('[options] [stamp] <key> <value>')
  .description('adjust time stamp boundaries or other properties')
  .option('-d, --datadir <path>')
  .action(set)

program
  .command('add <start> <end>')
  .description('add an entry')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(add)

program
  .command('remove [stamp]')
  .alias('rm')
  .description('remove an entry')
  .option('-d, --datadir <path>')
  .action(remove)

program
  .command('help', {
    noHelp: true
  })
  .action(help)

// Show help if no command given
if (!argvs[0].slice(2).length) {
  program.help()
}

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

function help () {
  program.help()
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

function stop (stamp, cmd) {
  var clocker = initialize(cmd)

  var data = {}
  ;['message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  clocker.stop(stamp, data, stopped)
}

function restart (stamp, cmd) {
  var clocker = initialize(cmd)

  clocker.restart(stamp, nil)
}

function list (cmd) {
  var clocker = initialize(cmd)

  clocker.dataStream({}).on('error', function (err) {
    ifError(err)
  }).on('end', function () {
    process.exit(0)
  }).on('data', function (entry) {
    printEntry(entry)

    if (cmd.verbose) {
      printMessage(entry.data.message)
    }
  })
}

function status (stamp, cmd) {
  var clocker = initialize(cmd)
  clocker.status(stamp, function (err, status) {
    ifError(err)
    success(status)
  })
}

function get (stamp, cmd) {
  var clocker = initialize(cmd)
  clocker.get(stamp, function (err, entry) {
    ifError(err)
    success(entry.data)
  })
}

function set (stamp, key, value, cmd) {
  if (typeof value === 'undefined') {
    // move properties since only stamp is optional
    value = key
    key = stamp
    stamp = undefined
  }

  var clocker = initialize(cmd)
  clocker.set(stamp, key, value, nil)
}

function add (start, end, cmd) {
  var clocker = initialize(cmd)

  var data = {
    end: end
  }
  ;['type', 'message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  clocker.add(start, end, data, nil)
}

function remove (stamp, cmd) {
  var clocker = initialize(cmd)
  clocker.remove(stamp, nil)
}

function initialize (cmd) {
  if (typeof cmd !== 'object') {
    program.outputHelp()
    process.exit(1)
  }
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
  ifError(err)
  success()
}

function stopped (err) {
  ifError(err)
  success()
}

function nil (err) {
  ifError(err)
  success()
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

function ifError (err) {
  if (err) {
    console.log(err)
    process.exit(1)
  }
}

function success (msg) {
  if (msg) {
    console.log(msg)
  }
  process.exit(0)
}
