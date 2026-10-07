# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

An order is full of time: when it opens, when it closes, how long it stays open. The obvious way to check orders is to
read the clock: take now, compare it with the end of each order, and call the orders that are past expired. That would
make the same file give a different report on a different day, so the saved output of the examples could never be
compared with a new run, two people reading the same commit could see two reports, and a batch prepared for a sale next
week would be judged against the day of the review instead of the day it is signed. A date in a file also brings its own
trouble: a time zone, a format, a calendar, and the difference between the time of a server and the time of a block.

Most checks of time do not need the clock at all. Whether an order ends before it starts, whether it never ends and how
long it stays open depend only on its start and end, and those are in the file. Only one question needs "now": whether
an order has already expired.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   list or a release was published. The same file and the same options give the same output on every machine and on
   every day.
2. The start and the end of an order are unix seconds, whole numbers of the file. The tool compares them and never turns
   one into a date or asks a chain for the time of a block.
3. "Now" is a number the caller gives with `--now`, in unix seconds. Only `order-expired` and the length of an order
   with no start use it. Without it, `order-expired` does not run and a note says so; nothing is called expired by
   guessing the time.
4. No document, example or test of this repository holds a date or a number that reads like a year: not the licence,
   not the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail
   on any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose; even so, the lines that carry a date or
   a number that reads like a year (the day an ERC page was created, and the lines of ERC-721 that name a year) were left
   out of the copies, so the test that reads every file for a year passes over them too. research/sources.md lists every
   line that was left out.
5. A version, an amount, a unix second or the number of a standard is not a year and is not caught: 1.0.0, Node 22, a
   price of 1.4175 ETH, unix second 1800000000, ERC-2981, ERC-721, ERC-1155, SARIF 2.1.0 and NIST SP 800-218 hold no
   year. The examples use unix seconds of ten digits, which hold no word of four digits, and a test of
   test/repo.test.js runs the pattern over such values and checks that none of them is caught, and that a year in the
   same place still is.
6. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because the
  examples name their `--now` and do not move with the calendar.
- A batch of orders can be checked long before it is signed, against the second it will be signed at.
- A pipeline that wants the check against the time of its run passes that time itself, such as `--now "$(date +%s)"`;
  the tool still reads no clock.
- The report holds no date and no deadline; the start and the end of an order are numbers of the file.
