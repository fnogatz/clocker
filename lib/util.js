module.exports = {}
module.exports.getDate = getDate
module.exports.isUnixTimestamp = isUnixTimestamp

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
