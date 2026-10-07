# marketplace-order-check: examples/bad/orders.json

- File: examples/bad/orders.json \(JSON, 19 lines, 3,944 bytes\)
- Chain: ethereum
- Collections: 2: Harbor Example Owls, ERC-721, royalty 500 basis points \(5%\) to 0x9999999999999999999999999999999999999999; Meadow Example Badges, ERC-1155, royalty 250 basis points \(2.5%\) to 0x8888888888888888888888888888888888888888
- Orders: 9 \(5 listings, 3 offers\)
- Now: unix second 1800000000, from --now
- Max expiry: 180 days
- Findings: 27 \(18 error, 6 warning, 3 info\)
- Result: **FAIL - 18 findings at or above error \(18 error, 6 warning, 3 info\)**

## Findings

| Level | Check | Where | Message |
| --- | --- | --- | --- |
| error | erc721-amount-not-one | examples/bad/orders.json:9 | Order L1 is for 2 of token \#7 of the ERC-721 collection Harbor Example Owls, but an ERC-721 holder has none or one of a token. Fix: Write an amount of 1 for an ERC-721 token, or correct the standard of the collection if it is ERC-1155. |
| error | price-zero | examples/bad/orders.json:11 | Order L3 has a price of 0 and is not marked as a transfer, so the token would go for nothing. This is a best practice of this tool, not a rule in the pages it cites. Fix: Set the price, or mark a gift or a move between own wallets with "transfer": true. |
| error | start-after-end | examples/bad/orders.json:11 | Order L3 starts at unix second 1800500000 and ends at 1800400000, so it is open for no second: it ends before it starts. This is a best practice of this tool, not a rule in the pages it cites. Fix: Set the end after the start; both are unix seconds. |
| error | erc1155-amount-above-balance | examples/bad/orders.json:12 | Order L4 lists 12 of token \#3 of the ERC-1155 collection Meadow Example Badges, but the file declares a balance of 5 for its maker. A compliant ERC-1155 contract reverts a transfer of more than the holder has. Fix: Lower the amount to the balance of the maker, or correct makerBalance if the maker holds more. |
| error | price-malformed | examples/bad/orders.json:12 | The price of order L4 has 7 decimal places, but USDC holds 6, so it cannot be paid as written. Fix: Write the price as a plain decimal in the unit of the currency, such as "0.25" for 0.25 ETH, with no sign, exponent or separator and no more places than the currency has \(18 for ETH, 6 for USDC\). |
| error | maker-is-taker | examples/bad/orders.json:13 | The taker of order L5 is its own maker, 0xdddddddddddddddddddddddddddddddddddddddd, so the order can only fill against the wallet that made it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Name the buyer or the seller the order is meant for as taker, or leave taker out for an order anyone may fill. |
| error | erc1155-amount-invalid | examples/bad/orders.json:13 | Order L5 is for 0 of token \#4 of the ERC-1155 collection Meadow Example Badges. This is a best practice of this tool, not a rule in the pages it cites. Fix: Write the number of tokens the order is for, 1 or more. |
| error | currency-chain-mismatch | examples/bad/orders.json:13 | The currency of order L5 is SOL, which the tool knows on no chain of the EVM family, but the chain of the file is ethereum. This is a best practice of this tool, not a rule in the pages it cites. Fix: Price the order in a currency of the chain of the file, or correct the chain. |
| error | fees-exceed-price | examples/bad/orders.json:13 | The fees of order L5 add up to 3 SOL, 1 SOL above its price of 2 SOL, so the seller would receive nothing and the order cannot be filled. This is a best practice of this tool, not a rule in the pages it cites. Fix: Lower the fees or raise the price until the fees are a part of it; check that a fee written in basis points was not written as an amount, or the other way round. |
| error | address-malformed | examples/bad/orders.json:14 | The maker of order O1, "0x12345", has 5 characters after 0x, not 40; an address is 0x followed by 40 hex digits. This is a best practice of this tool, not a rule in the pages it cites. Fix: Copy the address again from the wallet or the contract; send nothing to a zero address, which no one holds. |
| error | offer-in-native-currency | examples/bad/orders.json:14 | Offer O1 is priced in ETH, the native currency of ethereum, which a marketplace cannot draw from the wallet of the buyer when a seller fills the offer; offers are paid in a wrapped token the buyer approved. This is a best practice of this tool, not a rule in the pages it cites. Fix: Price the offer in the wrapped token of the chain, such as WETH, and have the buyer approve it for the marketplace. |
| error | order-expired | examples/bad/orders.json:14 | Order O1 ends at unix second 1799900000, 100,000 seconds before the second given with --now, 1800000000, so it can no longer be filled. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give the order a later end and sign it again, or remove it from the file. |
| error | address-malformed | examples/bad/orders.json:14 | The recipient of fee 1 of order O1, "0x0000000000000000000000000000000000000000", is the zero address, which no one holds; a fee sent there is lost. This is a best practice of this tool, not a rule in the pages it cites. Fix: Copy the address again from the wallet or the contract; send nothing to a zero address, which no one holds. |
| error | criteria-root-missing | examples/bad/orders.json:15 | Order O2 is an offer for a set of tokens with no criteria, so no merkle root names the tokens it covers. This is a best practice of this tool, not a rule in the pages it cites. Fix: Build the merkle tree of the token ids the offer covers and set its root in criteria.root, or make the offer a collection offer if it covers every token. |
| error | field-duplicate | examples/bad/orders.json:16 | The id o1 is also the id of the order at line 14; each order needs an id of its own. Fix: Give every order an id of its own, and declare each contract once. |
| error | secret-in-file | examples/bad/orders.json:16 | The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key. The tool never reads one, and the value is not shown. Fix: Remove the value from the file and from wherever the file was copied, treat it as exposed and move what it controls to a new key. An order export names wallets by their public address only. |
| error | field-missing | examples/bad/orders.json:17 | Order O4 has no price. Fix: Add the field named; docs/inputs.md lists what the file needs. |
| error | field-invalid | examples/bad/orders.json:17 | The side of order O4 is "bid"; it must be one of listing, offer. Fix: Write the value as docs/inputs.md shows: text for ids, addresses and choices, whole numbers for amounts, balances and times, plain decimal numbers for prices and fee amounts, true or false for flags. |
| warning | expiry-too-long | examples/bad/orders.json:9 | Order L1 is open for more than 358 days from its start, longer than the 180 days of --max-expiry-days. This is a best practice of this tool, not a rule in the pages it cites. Fix: Shorten the order, or raise --max-expiry-days for a file whose orders are long on purpose. |
| warning | royalty-receiver-mismatch | examples/bad/orders.json:9 | Fee 2 of order L1 pays royalty to 0x7777777777777777777777777777777777777777, but collection Harbor Example Owls declares 0x9999999999999999999999999999999999999999 as its receiver. The royaltyInfo of ERC-2981 answers a marketplace with the address the royalty is sent to. Fix: Pay the royalty to the receiver the contract declares, or update the declared receiver in the file if the contract was changed. |
| warning | duplicate-listing | examples/bad/orders.json:10 | Order L2 lists token \#7 of Harbor Example Owls by the same maker as order L1 at line 9 at another price, 1.5 ETH there and 1.2 ETH here. This is a best practice of this tool, not a rule in the pages it cites. Fix: Keep one listing per token and cancel the other; if the price changed, cancel the older listing on chain. |
| warning | order-never-expires | examples/bad/orders.json:10 | Order L2 has no end, so it stays open for good and can be filled long after its price stopped making sense. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give every order an end, in unix seconds, no further ahead than the order is meant to last. |
| warning | royalty-above-declared | examples/bad/orders.json:10 | Order L2 pays 0.09 ETH of royalty, but the royalty of 5% that collection Harbor Example Owls declares works out to 0.06 ETH on the price of 1.2 ETH. Under ERC-2981 the royalty owed is a percentage of the sale price. Fix: Set the royalty of the order to the declared share of its price, or correct the declared royalty of the collection. |
| warning | field-unknown | examples/bad/orders.json:13 | The key "makerBalanse" of order 5 is not one the tool reads, so its value was left out of every check. Did you mean "makerBalance"? The keys of order 5 are id, orderHash, side, kind, maker, taker, contract, tokenId, amount, makerBalance, price, currency, start, end, fees, criteria, transfer, notes. Fix: Correct the spelling to a field of docs/inputs.md, or remove it. |
| info | royalty-below-declared | examples/bad/orders.json:9 | Order L1 pays 0.045 ETH of royalty, but the royalty of 5% that collection Harbor Example Owls declares works out to 0.075 ETH on the price of 1.5 ETH. ERC-2981 leaves the payment of a royalty to the marketplace, so this is a note. Fix: Pay the declared share of the price as royalty if the marketplace or the creator expects it, or keep the order as it is on purpose. |
| info | royalty-below-declared | examples/bad/orders.json:13 | Order L5 pays no royalty, but the royalty of 2.5% that collection Meadow Example Badges declares works out to 0.05 SOL on the price of 2 SOL. ERC-2981 leaves the payment of a royalty to the marketplace, so this is a note. Fix: Pay the declared share of the price as royalty if the marketplace or the creator expects it, or keep the order as it is on purpose. |
| info | collection-offer-without-criteria | examples/bad/orders.json:16 | Order o1 is a collection offer, so any holder of Harbor Example Owls may fill it with the token they want least. This is a best practice of this tool, not a rule in the pages it cites. Fix: Keep the collection offer if any token will do, or make it an offer for a set of tokens with a merkle root of their ids. |

## Orders (9)

| Order | Side | Collection | Token | Amount | Price | Fees | Seller gets |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| L1 | listing | Harbor Example Owls | \#7 | 2 | 1.5 ETH | 0.0825 ETH | 1.4175 ETH |
| L2 | listing | Harbor Example Owls | \#7 | - | 1.2 ETH | 0.12 ETH | 1.08 ETH |
| L3 | listing | Harbor Example Owls | \#8 | - | 0 | 0 | - |
| L4 | listing | Meadow Example Badges | \#3 | 12 | - | - | - |
| L5 | listing | Meadow Example Badges | \#4 | 0 | 2 SOL | 3 SOL | - |
| O1 | offer | Harbor Example Owls | \#9 | - | 0.8 ETH | 0.06 ETH | 0.74 ETH |
| O2 | offer | Harbor Example Owls | by root | - | 0.5 WETH | 0.025 WETH | 0.475 WETH |
| o1 | offer | Harbor Example Owls | any | - | 0.4 WETH | 0.02 WETH | 0.38 WETH |
| O4 | - | Harbor Example Owls | \#10 | - | - | - | - |

This report is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended.
