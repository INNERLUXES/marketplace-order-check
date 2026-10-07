# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "marketplace-order-check security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up order file that shows the problem, the command you ran, what you expected and what happened. Use
made-up names and made-up addresses, never the orders of a real sale before it is public or the wallet of a real person,
and never a real private key, seed or mnemonic, even an old one or one from a test network.

## Scope

The tool is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice,
not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended. In scope:

- an input that makes the tool show a private key, a seed or a mnemonic, or any part of one, in a report or an error
  message, in any format, or the value of a criteria root or an order hash
- a key or a seed in one of the shapes docs/limits.md names that the tool does not report, outside the two keys of a
  hash that docs/limits.md names
- an input that makes the tool read a file other than the one it was given, or follow a symbolic link
- an input that makes the tool open a network connection, fetch a URL, contact a chain, a node, a marketplace or an API,
  sign anything, run any other program, or evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as a very large
  file, a hundred thousand orders, arrays and objects nested deep, very long ids or numbers with thousands of digits
- binary or invalid input that the tool reads as if it were an order file
- a key written twice whose second value is taken without a finding, a field the tool did not read that a check reports
  as fine, or a misspelt key that is not reported
- an order that docs/method.md says is reported (fees of the whole price, a royalty to another receiver, an expired
  order with `--now`, a price of 0, an ERC-1155 listing above its balance, a malformed address) that the tool does not
  report
- a price, a fee, a share or a token id that the tool reads in a way the decimal text of the file does not say, so that
  a check passes or fails because of it
- a run that passes at a `--fail-on` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from the file or a file name that rewrites the terminal through control or direction characters, is shown
  unescaped in the output, or puts markup into the markdown report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether the orders are good orders for the sale (a
clean result is not legal or financial advice and not an audit), whether the export matches the orders that are signed
or the state of the chain, whether a merkle root matches its tokens, secrets in shapes the search does not claim to
know, who may change or upload the file, and where your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
