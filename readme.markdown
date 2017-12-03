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

  clocker start {-t TYPE, -m MESSAGE}
    Start the clock. Optionally give a TYPE and MESSAGE.

  clocker stop {-m MESSAGE}
    Stop the clock.

  clocker restart [STAMP]
    Restart either last clock or clock at STAMP.

  clocker status
    Show the elapsed time if the clock is active or "stopped".

  clocker data {-t TYPE, -r RATE, --title TITLE, --gt=DATE, --lt=DATE, -a}
    Generate invoicer-compatible json output.
    Show dates between lt and gt. Show archived dates with -a.
    Optionally filter by TYPE, a string or /regex/.

  clocker list {-v, --gt DATE, --lt DATE, -a, -t TYPE}
    Show hourly data with STAMPS on the leftmost column.
    In verbose mode (-v), also show clocked messages.
    Show dates between lt and gt. Show archived dates with -a.
    Optionally filter by TYPE, a string or /regex/.

  clocker csv {--gt DATE, --lt DATE, -a}
    Generate CSV output.
    Show dates between lt and gt. Show archived dates with -a.

  clocker add START END {-t TYPE, -m MESSAGE}
    Add a hours from START to END as date strings.

  clocker get STAMP
    Get the data at STAMP.

  clocker rm STAMP...
    Remove the data at STAMP.

  clocker set [STAMP] KEY VALUE
    Adjust time stamp boundaries or other properties of either last clock
    or clock at STAMP.
    Time stamp boundaries are parsed, like '20:11' or '10 minutes ago'.

  clocker edit STAMP {KEY}
    Launch $EDITOR to edit the record at STAMP.
    Optionally edit a single KEY.

  clocker archive {--lt=DATE, --gt=DATE}
  clocker archive [STAMP...]
    Archive a range of clocked records or a list of STAMPs.
 
  clocker unarchive {--lt=DATE, --gt=DATE}
  clocker unarchive [STAMP...]
    Un-archive a range of clocked records or a list of STAMPs.

  Global Output Flags:
    clocker (status|ls|data|csv) --rnd=<ceil|floor|round>:<n>:<minutes|seconds>
      Apply rounding function to stamps prior to output. e.g.
        clocker ls --rnd=round:'30 seconds' (nearest half-minute)
        clocker ls --rnd=ceil:'6 minutes' (tenths of hour, always up)

    clocker (status|ls) [--sec|--no-sec]
      Don't display seconds
```

## Optional Output Manipulating Flags

Timestamps may be manipulated for some output commands as follows

### Rounding (--rnd) [status, ls, data, csv]

Apply rounding functions to the stamps. Available functions are: ceil, floor, and round. The precision of the rounding may be arbitrarily specified. The Date fields that may be rounded are: hours, minutes, and seconds.

### Suppress Seconds (--no-sec) [ls, status]

Don't display sconds.


# install

With [npm](https://npmjs.org) do:

```
npm install -g clocker
```

to get the clocker command.

# configuration

The output manipulating options may also be made permanent by creating a configuration file in ~/.clocker/config.json. The format is remarkably similar to:

    {
        "rnd": [ "ceil", 6, "minutes" ],
        "fmt": {
            "suppress_sec": true
        }
    }


# license

MIT
