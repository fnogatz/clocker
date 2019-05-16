const test = require('tape')
const { toStamp, getKey, formatElapsed } = require('../lib/util')

test('formatElapsed', (t) => {
  const testCases = [
    [5, '00:00:05'],
    [125, '00:02:05'],
    [3725, '01:02:05']
  ]
  testCases.forEach(([elapsedSeconds, expectedStringRepresentation]) => {
    t.test(`${elapsedSeconds} => ${expectedStringRepresentation}`, (t) => {
      const result = formatElapsed(elapsedSeconds)
      t.equal(result, expectedStringRepresentation)
      t.end()
    })
  })
})

test('toStamp', (t) => {
  const testCases = [
    ['time!2018-03-13 07:15:00', 1520921700],
    ['time!2019-05-16 21:05:00', 1558033500]
  ]
  testCases.forEach(([stringWithTimestamp, expectedEpochSeconds]) => {
    t.test(`${stringWithTimestamp} => ${expectedEpochSeconds}`, (t) => {
      const result = toStamp(stringWithTimestamp)
      t.equal(result, expectedEpochSeconds)
      t.end()
    })
  })
})

test('getKey', (t) => {
  const testCases = [
    [NaN, 'time!NaN'],
    [new Date('2019-05-16'), 'time!2019-05-16 02:00:00'],
    [new Date(1520921700000), 'time!2018-03-13 07:15:00']
  ]
  testCases.forEach(([stringWithTimestamp, expectedEpochSeconds]) => {
    t.test(`${stringWithTimestamp} => ${expectedEpochSeconds}`, (t) => {
      const result = getKey(stringWithTimestamp)
      t.equal(result, expectedEpochSeconds)
      t.end()
    })
  })
})
