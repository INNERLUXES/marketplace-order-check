# 3. Check the orders on disk, and contact no chain

## Status

Accepted

## Context

Many facts about an order live elsewhere: whether the maker holds the token and approved it, the royalty the contract
returns from royaltyInfo, the balance of an ERC-1155 holder, whether an order was already filled or cancelled, the time
of the latest block, the fee rules of the marketplace. A check could call a node on every run, read the contracts, ask
the marketplace for its orders and its fees. That would need the network, a node and often an API key, would make the
result depend on the state of a chain and of other people's services at the moment of the run, would send the addresses
of makers and the prices of unannounced sales to a third party, and would let a file in a pull request make the
pipeline reach any address it names.

What a marketplace team or a seller needs first, before a batch of orders is signed or filled, is a list of what is
wrong in the orders and where: fees that take the whole price, a royalty sent to an old receiver, a listing at 0, an
offer that never ends. The orders can be written as a file, reviewed like code and checked the same way on every run.
The facts that live on chain, such as the declared royalty and the balance of a maker, can be read once by the exporter
and written into the same file, where a reviewer sees them too.

## Decision

1. The tool reads the file it is given, and nothing else. It contacts no chain, node, marketplace or API, fetches
   nothing, opens no link, needs no key, runs no program and sends no data anywhere. It cannot sign, fill or cancel an
   order.
2. The file stands for the orders, the collections and the facts read from the chain. The tool works out fees,
   royalties, lengths and amounts from the file alone, and never asks a chain.
3. The file is the tool's own export format, not the raw structs of a marketplace protocol. A script turns the orders
   of a protocol, such as the open order format Seaport, into the export; the checks stay the same whatever protocol
   signs the orders, and no protocol page has to be trusted or saved.
4. The form of an address, the chains and the currencies with their decimal places are tables in the code, kept short
   and named in docs/limits.md. They are updated in a release, never fetched while the tool runs.
5. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources. A check that no page says is a best practice of this tool and says so.
6. The tool lists what to look at and what to change; it changes nothing and sends nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no node, and sends nothing
  anywhere.
- An export that does not match the chain gives a report about the export, not about the chain; docs/limits.md says so.
- A merkle root is checked for its form, not against the tokens it stands for; a balance and a declared royalty are the
  exporter's word.
