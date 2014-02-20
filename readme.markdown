# clocker

track project hours

[![clocker](http://substack.net/images/clocker.png)](http://substack.net/images/clocker.svg)

# example

To start tracking hours, just do `clocker start`:

```
$ clocker start -t BAZCORP
```

The `-t` is optional.

Some hours pass, then:

```
$ clocker stop
```

Run `clocker start` and `clocker stop` as you have more hours to track.

You can list the hours you've racked up with `clocker list`:

```
$ clocker list
1392707136  2014-02-17  [ 23:05:36 - 02:15:00 ]  (03:09:24)  [BAZCORP]
1392751800  2014-02-18  [ 11:30:00 - 16:20:00 ]  (04:50:00)  [BAZCORP]
1393020600  2014-02-21  [ 14:10:00 - 18:32:00 ]  (04:22:00)  [BAZCORP]
```

You can generate a json dump with `clocker data`:

```
$ clocker data BAZCORP --rate 125
[
  {
    "title": "consulting",
    "rate": 125,
    "hours": [
      {
        "date": "2014-02-18",
        "hours": 7.1
      },
      {
        "date": "2014-02-17",
        "hours": 0.9
      },
      {
        "date": "2014-02-21",
        "hours": 4.4
      }
    ]
  }
]
```

This json output can be fed into [invoicer](https://npmjs.org/package/invoicer)
to generate a PDF invoice:

```
$ clocker data BAZCORP --rate 125 | invoicer -r BAZCORP -o invoice.pdf
```

# usage

```
usage:

  clocker start {-t TYPE}
    Start the clock. Optionally give a TYPE.

  clocker stop
    Stop the clock.

  clocker status
    Show the elapsed time if the clock is active or "stopped".

  clocker data {-t TYPE, -r RATE, --title TITLE}
    Generate invoicer-compatible json output.

  clocker list {-v}
    Show hourly data with STAMPS on the leftmost column.
    In verbose mode (-v), also show clocked messages.

  clocker get STAMP
    Get the data at STAMP.

  clocker rm STAMP
    Remove the data at STAMP.

  clocker set STAMP KEY VALUE
    Adjust time stamp boundaries or other properties.

```

# install

With [npm](https://npmjs.org) do:

```
npm install -g clocker
```

to get the clocker command.

# license

MIT
