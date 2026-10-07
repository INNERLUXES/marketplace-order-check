# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended. Five checks are documented by the pages: `royalty-receiver-mismatch`, `royalty-above-declared` and `royalty-below-declared` by ERC-2981, `erc721-amount-not-one` by ERC-721 and `erc1155-amount-above-balance` by ERC-1155. Every other check that is not about the file itself is a best practice of this tool, not a rule in the pages it cites, and says so in its message and in its own entry below with the reason. ERC-2981 speaks of a percentage of the sale price, calls the payment of a royalty voluntary, and names neither basis points nor the fee of a marketplace; the tool reads shares in basis points and adds up fees as its own choice. No saved page describes an order format, the fees of a marketplace, the expiry of an order, offers or currencies.

## The pages

- ERC-2981: NFT Royalty Standard: https://eips.ethereum.org/EIPS/eip-2981 (copy: `research/sources/eip-2981-nft-royalty-standard.txt`)
- ERC-721: Non-Fungible Token Standard: https://eips.ethereum.org/EIPS/eip-721 (copy: `research/sources/eip-721-non-fungible-token.txt`)
- ERC-1155: Multi Token Standard: https://eips.ethereum.org/EIPS/eip-1155 (copy: `research/sources/eip-1155-multi-token.txt`)

## file-unreadable

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the order file is not JSON the reader can follow, or its top level is not an object, so nothing in it was read.
- Cannot see: It stops at the first place that is not strict JSON, or at a top level that is not an object, so nothing in the file is checked; an export written as YAML, CSV, a spreadsheet or raw order structs is not read.
- What to change: Write the export as one JSON object with the chain, the collections and the orders (docs/inputs.md); fix the line named.
- Points of the pages: none; this check is about the file itself.

## field-missing

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a field the checks need is not in the file: the chain, the collections or the orders, the contract or the standard of a collection, or the id, side, maker, contract, token id, amount of an ERC-1155 order, price or currency of an order, the kind or the recipient of a fee, or a declared collection for the contract of an order.
- Cannot see: It names the field and the part, the order or the fee that lacks it; it does not guess the value, and the checks that need the field do not run for that part.
- What to change: Add the field named; docs/inputs.md lists what the file needs.
- Points of the pages: none; this check is about the file itself.

## field-unknown

- Level: warning
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a key the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one differs only in case or separators, is one letter apart or starts the same, and the value is left out of every check.
- What to change: Correct the spelling to a field of docs/inputs.md, or remove it.
- Points of the pages: none; this check is about the file itself.

## field-invalid

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a value of the wrong type or form: text where a whole number belongs, a chain, standard, side, kind or fee kind the tool does not know, a token id that is not a whole number of at most 78 digits, a hash that is not 64 hex digits, a fee with both bps and amount, a listing of kind collection or criteria, a token id or criteria on an order of the wrong kind, or a transfer with a price.
- Cannot see: It names the value and the form it needs; the value is left out of the checks that need it. It reads the chain, the standard, the side, the kind and the fee kind from short lists of words, and a hash only for its form of 64 hex digits.
- What to change: Write the value as docs/inputs.md shows: text for ids, addresses and choices, whole numbers for amounts, balances and times, plain decimal numbers for prices and fee amounts, true or false for flags.
- Points of the pages: none; this check is about the file itself.

## field-duplicate

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: two orders share an id (compared without case and outer spaces), or a contract is declared as two collections, so a reader of the file cannot tell them apart.
- Cannot see: It compares the ids of orders without case and outer spaces, and the contracts of collections as addresses; two ids that differ in one letter are not the same to it.
- What to change: Give every order an id of its own, and declare each contract once.
- Points of the pages: none; this check is about the file itself.

## secret-in-file

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the file holds a private key, a seed or a mnemonic, under a key named for one or as a value shaped like one; the tool never reads it and never shows it.
- Cannot see: It knows a secret by the name of its key and by the shapes of docs/limits.md. A value of 64 hex digits under root or orderHash is read as a hash, and a token id of exactly 64 digits is reported as a key.
- What to change: Remove the value from the file and from wherever the file was copied, treat it as exposed and move what it controls to a new key. An order export names wallets by their public address only.
- Points of the pages: none; this check is about the file itself.

## price-malformed

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the price of an order or the amount of a fee is not a plain decimal number of 0 or more, or has more decimal places than the currency of the order holds.
- Cannot see: It knows the decimal places of the currencies of docs/limits.md only; the price of another currency is checked for its form, not for its places.
- What to change: Write the price as a plain decimal in the unit of the currency, such as "0.25" for 0.25 ETH, with no sign, exponent or separator and no more places than the currency has (18 for ETH, 6 for USDC).
- Points of the pages: none; this check is about the file itself.

## fees-exceed-price

- Level: error
- Kind: best practice
- Looks at: the marketplace fee, the royalty and the other fees of an order add up to its whole price or more, so the seller would receive nothing or the order could not be filled.
- Cannot see: It adds up the fees the export lists, in the currency of the order. A fee the marketplace adds later, gas, and the rounding of a share to the smallest unit of the token are not seen; a fee that could not be read is left out of the sum.
- What to change: Lower the fees or raise the price until the fees are a part of it; check that a fee written in basis points was not written as an amount, or the other way round.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: adding up the fees of an order against its price is a best practice of this tool, not a rule in the pages it cites; the pages it cites do not describe the fees of a marketplace, and an order whose fees take the whole price is never what a seller means.

## royalty-receiver-mismatch

- Level: warning
- Kind: documented
- Looks at: an order pays its royalty to an address other than the ERC-2981 receiver the file declares for the collection, though royaltyInfo names the address the royalty is sent to.
- Cannot see: It compares the recipient of each royalty fee with the receiver the file declares, not with the contract on chain, and cannot see a receiver that splits the royalty further.
- What to change: Pay the royalty to the receiver the contract declares, or update the declared receiver in the file if the contract was changed.
- Points of the pages:
  - The royaltyInfo function of ERC-2981 answers a marketplace with two values for a sale: the address the royalty is to be sent to, and the amount. (ERC-2981: NFT Royalty Standard, https://eips.ethereum.org/EIPS/eip-2981)

## royalty-above-declared

- Level: warning
- Kind: documented
- Looks at: an order pays more royalty than the ERC-2981 royalty the file declares for the collection works out to on its price.
- Cannot see: It compares with the share the file declares, in basis points, and counts a royalty less than one smallest unit of a known currency away as the declared one, since ERC-2981 lets the amount be rounded; a royalty that changes by token or by sale, or a contract with another denominator, is not seen.
- What to change: Set the royalty of the order to the declared share of its price, or correct the declared royalty of the collection.
- Points of the pages:
  - Under ERC-2981 the royalty owed on a sale is worked out as a share of the sale price and paid in the unit of the sale; the page speaks of a percentage, and names no unit such as basis points and no largest value. (ERC-2981: NFT Royalty Standard, https://eips.ethereum.org/EIPS/eip-2981)

## royalty-below-declared

- Level: info
- Kind: documented
- Looks at: an order pays less royalty than the ERC-2981 royalty the file declares for the collection works out to on its price, or none; ERC-2981 leaves the payment to the marketplace, so this is a note.
- Cannot see: It cannot know whether a marketplace pays less on purpose, or pays the royalty outside the order; that is why it is a note. A royalty less than one smallest unit of a known currency below the declared share is the declared one rounded down.
- What to change: Pay the declared share of the price as royalty if the marketplace or the creator expects it, or keep the order as it is on purpose.
- Points of the pages:
  - Under ERC-2981 the royalty owed on a sale is worked out as a share of the sale price and paid in the unit of the sale; the page speaks of a percentage, and names no unit such as basis points and no largest value. (ERC-2981: NFT Royalty Standard, https://eips.ethereum.org/EIPS/eip-2981)
  - ERC-2981 only lets a contract signal its royalty; the page leaves the payment to the marketplaces and calls it voluntary, since a move of a token between wallets is not always a sale. (ERC-2981: NFT Royalty Standard, https://eips.ethereum.org/EIPS/eip-2981)

## order-never-expires

- Level: warning
- Kind: best practice
- Looks at: an order has no end, an end of never, or an end so far ahead that it stays open for good, so a price that is forgotten can be filled at any time.
- Cannot see: It reads an end of never, a missing end, or an end of 13 digits or more as an order that never expires; an end of 12 digits far in the future is a time, and expiry-too-long weighs it.
- What to change: Give every order an end, in unix seconds, no further ahead than the order is meant to last.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: asking for an end on every order is a best practice of this tool, not a rule in the pages it cites; a listing or an offer that stays open for good can be filled long after its price stopped making sense.

## expiry-too-long

- Level: warning
- Kind: best practice
- Looks at: an order is open for longer than --max-expiry-days (180 days by default), counted from its start, or from --now when it has none.
- Cannot see: It counts from the start of the order, or from --now when the order has none; with neither, the order is not measured and a note says how many.
- What to change: Shorten the order, or raise --max-expiry-days for a file whose orders are long on purpose.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: warning above a length of 180 days is a best practice of this tool, not a rule in the pages it cites; the pages it cites set no length, and the threshold can be changed with --max-expiry-days.

## order-expired

- Level: error
- Kind: best practice
- Looks at: an order ends at or before the second given with --now, so it can no longer be filled; the check runs only when --now is given.
- Cannot see: It reads no clock. Without --now it does not run, and a note says so; it cannot tell whether an order was filled or cancelled.
- What to change: Give the order a later end and sign it again, or remove it from the file.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: comparing the end of an order with --now is a best practice of this tool, not a rule in the pages it cites; the tool reads no clock, so the check runs only when --now names the second to compare with.

## start-after-end

- Level: error
- Kind: best practice
- Looks at: an order starts at or after its end, so it is open for no second.
- Cannot see: It compares the two numbers of the file as unix seconds; an order with one of them written in milliseconds is reported only when the start ends up after the end.
- What to change: Set the end after the start; both are unix seconds.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: refusing an order that ends at or before its start is a best practice of this tool, not a rule in the pages it cites; such an order is almost always a start and an end written the wrong way round or in two different units.

## price-zero

- Level: error
- Kind: best practice
- Looks at: an order has a price of 0 and is not marked as a transfer, so the token would go for nothing.
- Cannot see: It cannot tell a gift from a mistake unless the order says "transfer": true; a price of one wei is a price.
- What to change: Set the price, or mark a gift or a move between own wallets with "transfer": true.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: refusing a price of 0 on an order that is not marked as a transfer is a best practice of this tool, not a rule in the pages it cites; a listing at 0 is the mistake that loses a token, and a real gift says so.

## currency-chain-mismatch

- Level: error
- Kind: best practice
- Looks at: the currency of an order belongs to other chains than the chain of the file, such as SOL or AVAX on ethereum.
- Cannot see: It knows the chains and currencies of docs/limits.md by their symbols only; a token of the same symbol at another address is not seen, and another currency is left alone with a note.
- What to change: Price the order in a currency of the chain of the file, or correct the chain.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: matching the currency of an order with the chain of the file is a best practice of this tool, not a rule in the pages it cites; the tool knows a short list of currencies and chains and leaves the others alone with a note.

## offer-in-native-currency

- Level: error
- Kind: best practice
- Looks at: an offer is priced in the native currency of its chain, such as ETH on ethereum, which a marketplace cannot draw from the wallet of the buyer.
- Cannot see: It knows the native currency of each chain of docs/limits.md; it cannot see whether the buyer approved the wrapped token or holds enough of it.
- What to change: Price the offer in the wrapped token of the chain, such as WETH, and have the buyer approve it for the marketplace.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: asking for a wrapped token on an offer is a best practice of this tool, not a rule in the pages it cites; an offer is filled later by the seller, who can draw a token the buyer approved but not the native currency of the buyer.

## duplicate-listing

- Level: warning
- Kind: best practice
- Looks at: the same maker lists the same token of the same contract twice, so the cheaper listing may be filled while the dearer one is the one the seller watches.
- Cannot see: It compares listings of one token id in one file, by maker, contract and token id; a listing on another marketplace, or one already cancelled on chain, is not seen.
- What to change: Keep one listing per token and cancel the other; if the price changed, cancel the older listing on chain.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: reporting a token listed twice by one maker is a best practice of this tool, not a rule in the pages it cites; two listings of one token at two prices are a mistake far more often than a plan.

## erc721-amount-not-one

- Level: error
- Kind: documented
- Looks at: an ERC-721 order for one token id has an amount other than 1, or an ERC-721 order of any kind is for 0 tokens, though an ERC-721 holder has none or one of a token.
- Cannot see: It trusts the standard the file declares for the collection; a contract that is really ERC-1155 declared as ERC-721 is reported here.
- What to change: Write an amount of 1 for an ERC-721 token, or correct the standard of the collection if it is ERC-1155.
- Points of the pages:
  - Under ERC-721 each token is set apart from every other by its id, so a holder has none or one of a given token, and the transfer functions move one token id with no amount. (ERC-721: Non-Fungible Token Standard, https://eips.ethereum.org/EIPS/eip-721)

## erc1155-amount-invalid

- Level: error
- Kind: best practice
- Looks at: an ERC-1155 order is for an amount of 0.
- Cannot see: It reads the amount the file gives; a marketplace that fills an order in parts is not seen.
- What to change: Write the number of tokens the order is for, 1 or more.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: refusing an amount of 0 is a best practice of this tool, not a rule in the pages it cites; ERC-1155 does not forbid a transfer of 0, but an order for nothing is never what a maker means.

## erc1155-amount-above-balance

- Level: error
- Kind: documented
- Looks at: an ERC-1155 listing is for more of a token than the balance of the maker the file declares, though a transfer of more than the balance reverts.
- Cannot see: It compares with the makerBalance the file declares, not with the chain, and only for listings that give one; a note counts the others. Two listings that together exceed the balance are not added up.
- What to change: Lower the amount to the balance of the maker, or correct makerBalance if the maker holds more.
- Points of the pages:
  - The transfer functions of ERC-1155 move an amount of a token id, and a compliant contract reverts when the holder has less of that id than the amount sent. (ERC-1155: Multi Token Standard, https://eips.ethereum.org/EIPS/eip-1155)

## address-malformed

- Level: error
- Kind: best practice
- Looks at: a maker, a taker, a contract, a fee recipient or a royalty receiver that is not 0x and 40 hex digits, or is the zero address where the zero address loses tokens or money.
- Cannot see: It checks the form of an address only, with no checksum of EIP-55 and no lookup, so a well formed address of the wrong wallet passes. A taker of zeros is an order anyone may fill and is not reported.
- What to change: Copy the address again from the wallet or the contract; send nothing to a zero address, which no one holds.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: checking the form of an address is a best practice of this tool, not a rule in the pages it cites; the form is the one wallets write on an EVM chain, no page is saved for it, and a typo or a zero address in an order sends tokens or fees where no one can reach them.

## maker-is-taker

- Level: error
- Kind: best practice
- Looks at: an order names its own maker as the only taker, so it can only fill against the wallet that made it.
- Cannot see: It compares two addresses of one order without case; a taker that is another wallet of the same person is not seen.
- What to change: Name the buyer or the seller the order is meant for as taker, or leave taker out for an order anyone may fill.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: refusing an order whose taker is its maker is a best practice of this tool, not a rule in the pages it cites; such an order moves nothing and pays fees for it, or was meant for another address.

## criteria-root-missing

- Level: error
- Kind: best practice
- Looks at: an offer for a set of tokens (kind criteria) has no merkle root of the token ids, or a root of zeros, so the marketplace cannot tell which tokens it covers.
- Cannot see: It checks the root for its form and for zeros only; it cannot rebuild the tree, so a root built from the wrong token ids passes.
- What to change: Build the merkle tree of the token ids the offer covers and set its root in criteria.root, or make the offer a collection offer if it covers every token.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: asking for a merkle root on an offer for a set of tokens is a best practice of this tool, not a rule in the pages it cites; the common way to name a set of tokens in an order is the root of a merkle tree of their ids, and an offer with none covers every token or none.

## collection-offer-without-criteria

- Level: info
- Kind: best practice
- Looks at: a collection offer covers every token of the contract, so any holder may fill it with the token they want least; a note, since many offers mean that.
- Cannot see: It cannot tell whether every token of the collection is worth the offer; that is why it is a note.
- What to change: Keep the collection offer if any token will do, or make it an offer for a set of tokens with a merkle root of their ids.
- Points of the pages: none; no page saved for this tool says this rule.
- The tool's own choice: noting that a collection offer covers every token is a best practice of this tool, not a rule in the pages it cites; it is a common kind of offer, so it is a note, never a warning.
