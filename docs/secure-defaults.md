# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the file it reads. A clean result is not legal or financial advice, not an audit of the marketplace or its
contracts and not a guarantee that an order will fill as intended; it is a file with none of the problems the checks
look for, not a finding that the orders are sound.

## How the tool behaves by default

- **Never a secret.** The tool needs no private key, no seed, no API key and no address of a node, and has no option to
  take one. A key named for a key or a seed, and a value shaped like one, anywhere in the file, is a `secret-in-file`
  error that fails the run; the value is left out of every check and never written to a report or an error message, in
  any format. The value of a criteria root or an order hash is never shown either.
- **Reads, never signs or sends.** The tool reads the one file it is given. It follows no symbolic link, fetches no URL,
  refuses an argument that looks like an address, contacts no chain, node, marketplace or API, evaluates nothing and
  writes nothing to disk. It cannot sign, fill or cancel an order.
- **Every check on from the first run.** Fees of the whole price, an expired order, an order that ends before it starts,
  a price of 0 that is not a transfer, a currency of another chain, an offer in the native currency, an ERC-721 amount
  other than 1, an ERC-1155 amount of 0 or above the balance, a malformed or zero address, a maker that is its own taker
  and an offer for a set of tokens with no root are errors; a royalty to another receiver or above the declared share,
  an order that never expires or lasts too long and a token listed twice are warnings; a royalty below the declared
  share and a collection offer are notes. There is no configuration file of the tool that could set a check off.
- **No clock.** The start and the end of an order are unix seconds of the file, and "now" is only the second given with
  `--now`. Without it no order is called expired, and a note says that the check did not run.
- **Fail closed on what it cannot read.** A file that is not strict JSON is an error finding that fails the run at the
  default `--fail-on` of `error`. A missing field and a value of the wrong type are findings of their own, so a part of
  the file that was not read is never taken for one that is fine. A misspelt key is a warning that names the key it is
  probably meant to be. A file that is not text, is too large or is a link stops the run with exit code `2` and no
  report.
- **Numbers as written.** A price and a fee amount are read from the characters of the file into a whole number and a
  scale, never through a floating point number, and a share in basis points is worked out exactly; a number with an
  exponent or a separator is refused, and a price with more places than its currency holds is an error.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place. A `--now` that is not a whole
  number of seconds and a `--max-expiry-days` that is not a whole number of days from 1 to 36500 are refused.
- **No pattern from the input.** No regular expression is built from the file or from an argument.
- **Bounded work.** The reader has limits of size, nesting, values and string length, the JSON reader, the search for
  secrets and the walk for hashes work with stacks of their own, and at most 10,000 orders, 1,000 collections and 20 fees
  an order are read (docs/limits.md), so a large or deep file cannot exhaust the stack, the memory or the time.
- **No prototype tricks.** Keys from the file are kept in lists and compared with the names the tool reads, never set
  as properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, collection names, order ids, addresses and currencies included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--now`.** Pass the second the orders are about to be signed or filled, such as `--now "$(date +%s)"` in a pipeline,
  so that expired orders are errors and orders with no start are measured from it.
- **`--fail-on warning`.** A royalty to another receiver or above the declared share, an order that never expires or
  lasts too long, a token listed twice and misspelt keys fail the run too. Use it on the batch that is about to be
  signed, and record each warning the team keeps on purpose.
- **`--fail-on info`.** A royalty below the declared share and collection offers fail the run too, for a marketplace
  that promises creators their full royalty.
- **A lower `--max-expiry-days`.** Set it to the longest order the marketplace or the seller means to keep open.
- **A complete export.** Give every order a start, an end and its fees, every collection its declared royalty, and every
  ERC-1155 listing the balance of its maker; a value the export does not give is a check that does not run, and a note
  says so.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Marketplace order check
    run: npx --yes github:INNERLUXES/marketplace-order-check exports/orders.json --now "$(date +%s)" --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no API key and no access to a
  node; never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Run the tool on the exact export the orders are signed from, and have the signing step refuse orders that differ from
  it. An export edited after the check is not what was checked.
- Keep exports of unannounced sales out of public repositories: they hold the addresses of makers, the prices and the
  balances before they are public. Run the tool where the export already is, and keep its reports with the same care,
  because a finding quotes ids, addresses and prices of the file.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-file`, treat the key or seed as exposed: remove it from the file and from every
  place the file was copied to, and move what it controls to a new key. The tool does not show the value, but the file
  itself was readable to everyone with access to it.

## Protecting the orders

A filled order moves a token and money at once and cannot be called back. Keep the code that writes orders under
review, sign orders from a wallet that holds only what it sells, give every order an end, pay offers from a wrapped
token the buyer approved for the marketplace and no more, and check every batch with this tool before it is signed: it
reads the orders as the file writes them, not whether the chain agrees with them.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
