const test = require('tape')
const { getKey, formatElapsed } = require('../lib/util')

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
