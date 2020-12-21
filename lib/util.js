const parseTime = require('parse-messy-time')
const strftime = require('strftime')

const KEY_FORMAT = 'time!%F %T'

function getDate (expr) {
  let d

  if (expr === null || expr === undefined) {
    d = new Date()
  } else if (typeof expr === 'object' && expr instanceof Date) {
    return expr
  } else if (isUnixTimestamp(expr)) {
    d = new Date(expr * 1000)
  } else if (typeof expr === 'string') {
    d = parseTime(expr)
  } else {
    d = new Date(expr)
  }

  checkPlausibilityOfDate(d, expr)

  return d
}

function isUnixTimestamp (expr) {
  return /^1[0-9]{9}$/.test(expr)
}

function checkPlausibilityOfDate (d, expr) {
  const now = new Date()
  const maxYearDiff = 10

  if (d.getFullYear() > now.getFullYear() + maxYearDiff || d.getFullYear() < now.getFullYear() - maxYearDiff) {
    throw new Error(`Expression "${expr}" was recognised as date "${d}" which does not seem to be correct.`)
  }
}

function formatElapsed (elapsed) {
  const n = elapsed
  const hh = pad(Math.floor(n / 60 / 60), 2)
  const mm = pad(Math.floor(n / 60 % 60), 2)
  const ss = pad(Math.floor(n % 60), 2)
  return [hh, mm, ss].join(':')
}

function pad (s, len) {
  return Array(Math.max(0, len - String(s).length + 1)).join('0') + s
}

function toStamp (stringWithTimestamp) {
  return Math.floor(new Date(stringWithTimestamp.split('!')[1]).valueOf() / 1000)
}

function getKey (x) {
  if (x === 'NaN') {
    return getKeyFromDate(new Date(NaN))
  }

  if (typeof x === 'object' && x instanceof Date) {
    return getKeyFromDate(x)
  }

  if (!/^\d+$/.test(x)) {
    return 'time!' + x
  }
  return getKeyFromDate(new Date(x * 1000))
}

function getKeyFromDate (date) {
  return strftime(KEY_FORMAT, date)
}

module.exports = {
  getDate,
  formatElapsed,
  toStamp,
  getKey
}
