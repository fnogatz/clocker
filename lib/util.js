var parseTime = require('parse-messy-time')

function getDate (expr) {
  var d
  var timestamp = Date.parse(expr)

  if (expr === null || expr === undefined) {
    d = new Date()
  } else if (typeof expr === 'object' && expr instanceof Date) {
    return expr
  } else if (isUnixTimestamp(expr)) {
    d = new Date(expr * 1000)
  } else if (isNaN(timestamp)) {
    d = parseTime(expr)
  } else {
    d = new Date(timestamp)
  }

  return d
}

function isUnixTimestamp (expr) {
  return /^1[0-9]{9}$/.test(expr)
}

function formatElapsed (elapsed) {
  var n = elapsed
  var hh = pad(Math.floor(n / 60 / 60), 2)
  var mm = pad(Math.floor(n / 60 % 60), 2)
  var ss = pad(Math.floor(n % 60), 2)
  return [ hh, mm, ss ].join(':')
}

function pad (s, len) {
  return Array(Math.max(0, len - String(s).length + 1)).join('0') + s
}

module.exports = {
  getDate,
  isUnixTimestamp,
  formatElapsed
}
