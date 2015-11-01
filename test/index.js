var test = require('tape');
var tempfile = require('tempfile');

var Clocker = require('../lib/clocker');

var StartDate = new Date('2015-01-23 12:23');

test('Clocker constructor', function (t) {
    t.test('Empty constructor', function (t) {
        var clocker = new Clocker();
        t.ok(clocker.file, 'clocker.file is not empty');

        t.end();
    });

    t.test('Filename specified', function (t) {
        var tmp = tempfile();

        var clocker = new Clocker(tmp);
        t.equal(clocker.file, tmp, 'clocker.file is given filename');

        t.end();
    });

    t.end();
});

test('Clocker.add()', function (t) {
    t.test('Empty dataset', function (t) {
        var clocker = new Clocker(tempfile());
        clocker.add(function (err) {
            t.notOk(err);
            t.end();
        });
    });

    t.test('With dataset', function (t) {
        var clocker = new Clocker(tempfile());
        clocker.add({
            type: 'mytype',
            message: 'My Message'
        }, function (err) {
            t.notOk(err);
            t.end();
        });
    });

    t.end();
});

test('Clocker.start()', function (t) {
    t.test('Empty dataset', function (t) {
        var clocker = new Clocker(tempfile());
        clocker.start(function (err) {
            t.notOk(err);
            t.end();
        });
    });

    t.test('With dataset', function (t) {
        var clocker = new Clocker(tempfile());
        clocker.start({
            type: 'mytype',
            message: 'My message'
        }, function (err) {
            t.notOk(err);
            t.end();
        });
    });

    t.end();
});

test('Clocker.stop()', function (t) {
    var clocker = new Clocker(tempfile());
    clocker.start(function () {
        clocker.stop(function (err) {
            t.notOk(err);
            t.end();
        })
    })
});

test('Clocker.data()', function (t) {
    t.test('Empty array for fresh database', function (t) {
        var clocker = new Clocker(tempfile());
        clocker.data(function (err, data) {
            t.notOk(err);
            t.equal(typeof data, 'object');
            t.ok(data instanceof Array);
            t.equal(data.length, 0);

            t.end();
        });
    });

    t.test('No query', function (t) {
        var datasets = 5;
        var clocker = testInstance(datasets);
        clocker.data(function (err, data) {
            t.notOk(err);
            t.ok(data instanceof Array);
            t.equal(data.length, datasets);

            t.end();
        });
    });

    t.test('Query: type', function (t) {
        var datasets = 5;
        var clocker = testInstance(datasets, {
            type: 'id'
        });
        clocker.data({
            type: 'type2'
        }, function (err, data) {
            t.notOk(err);
            t.ok(data instanceof Array);
            t.equal(data.length, 1);

            t.end();
        });
    });

    t.test('Query: start', function (t) {
        t.test('All datasets', function (t) {
            var datasets = 5;
            var clocker = testInstance(datasets);
            clocker.data({
                start: StartDate
            }, function (err, data) {
                t.notOk(err);
                t.ok(data instanceof Array);
                t.equal(data.length, datasets);

                t.end();
            });
        });

        t.end();
    });

    t.end();
});

function testInstance (datasets, data) {
    datasets = datasets || 0;
    data = data || {};
    var tmp = tempfile();
    var clocker = new Clocker(tmp);

    var date = new Date(StartDate);

    var start, end, dataset
    for (var i = 0; i < datasets; i++, date.setDate(date.getDate() + 1)) {
        start = date;
        end = new Date(date);
        end.setHours(end.getHours() + 4);

        dataset = {
            start: start,
            end: end
        };
        for (var key in data) {
            dataset[key] = data[key];
        }
        if (data.type === 'id') {
            dataset.type = 'type'+i;
        }
        clocker.add(dataset);
    }

    return clocker;
}
