# Threat model

The tool is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice,
not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended. This document
is about the tool itself: what it touches, what a hostile or careless order file can try, and what stops it.

## What the tool touches

- It reads the one file named on the command line. Nothing else is opened, and no address, URL or path written in the
  file is looked up, opened or followed.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no URL, contacts no chain, node, marketplace or API, signs nothing, follows no
  symbolic link, runs nothing it reads, evaluates nothing and reads no clock and no locale.

## What the input may hold

An order file comes from a marketplace backend, a wallet, a bot or a person who edits it, and in a pipeline that checks
every pull request it may be written by whoever opened the pull request. Through it, a person can try to, or a careless
change can:

- put a private key, a seed or a mnemonic in the file, as a key next to the maker, a note of an order or the recipient
  of a fee, so that the tool copies it into a pipeline log, a pull request comment or a code scanning upload;
- hide a private key under `root` or `orderHash`, where a hash of the same shape belongs;
- make the tool read outside the file: a link named on the command line, a folder, an address given as the path;
- make the tool reach a chain or a server: an address of a wallet or a contract written in the file;
- exhaust the memory, the stack or the time: a file of many megabytes, a hundred thousand listings of one token, arrays
  and objects nested very deep, very long ids and addresses, numbers with thousands of digits;
- move the result: a key written twice so that two readers see two prices, a misspelt key that hides a balance, a field
  of the wrong type that might be taken as fine, prices and fees that a floating point number would read wrongly, an end
  written as the largest number a uint256 holds;
- slip in something that is not text: a binary file named `.json`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, escape sequences, direction controls and line separators
  in a collection name, an order id, an address or a currency;
- hide markup in the markdown report: a link, a table separator or a tag in a name;
- change how objects behave: a key, a currency, a chain, a side or an id named `__proto__`, `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A secret in the file is copied into the output | Before the file is read, every key and value is looked at for a key or a seed; each one found is a `secret-in-file` error, the value is marked, the reader leaves it out as if it were not there, and no message names it. Tests put each shape under several fields and check every format for the value |
| A key under `root` or `orderHash` is copied into the output | A value of 64 hex digits there is read as a hash and is not reported, and the tool never shows the value of either key, only what it is for; any other shape there is still a secret. A test checks every format for the hashes of a file |
| A link makes the tool read a file it was not given | The path is checked with `lstat` and a link is refused by name; the file is opened with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A test puts a link in the folder |
| The tool reaches a chain or a server, fetches, connects, signs or runs something | No module of the network or of child processes is imported, nothing is evaluated, an address is only text that is checked for its form, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | The file has a size limit checked on the open handle before it is read; the reader keeps limits of nesting, values and string length, the JSON reader, the search for secrets and the walk for hashes keep stacks of their own; at most 10,000 orders, 1,000 collections and 20 fees an order are read, and listings written twice are found with one map, never by comparing every pair. Tests check the time, with limits that widen under coverage only |
| A key written twice hides a value | A key written twice in one JSON object is a `file-unreadable` finding |
| A misspelt or missing field passes for one that is fine | A key the tool does not read is a `field-unknown` finding with the key it is probably meant to be; a missing field is `field-missing`; a value of the wrong type is `field-invalid`; each with its line |
| Prices, fees or token ids are read wrongly | Prices and fee amounts are read from the characters of the file with BigInt, shares are worked out exactly, and a token id is kept as its digits; an exponent or a separator is refused, and a number past its limit is a finding, never rounded |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes in UTF-16 and bytes that are not valid make the file an input error with exit code `2` and no report |
| Text from the file rewrites the terminal | Every text from the input goes through `safeText`, which replaces control, line separator and direction characters and caps the length. A test puts escapes and direction controls in a collection name and in order ids, in every format |
| Markup in a name changes the markdown report | The markdown report escapes the characters markdown gives a meaning to. A test writes a link into a collection name |
| `__proto__` changes how objects behave | Objects of the file are lists of entries compared with the names the tool reads, and no object is built with a key from the file; chains and currencies are looked up with `Object.hasOwn`. A test uses `__proto__`, `constructor`, `hasOwnProperty` and `toString` as keys, currencies, chains, sides and ids |
| The time of the run changes the result | No clock is read; "now" is only the second given with `--now`, so the same file and options give the same report on every day |
| A device or a pipe hangs the tool | A path that is not a regular file is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the export matches the orders that are signed, whether the maker holds the token or approved it, whether a
contract really declares the royalty the file says, whether a merkle root matches the tokens of an offer, whether a sale
is lawful where it takes place, the forms and secrets docs/limits.md says the tool does not see, who may change or upload
the file, and where your pipeline keeps the output.
