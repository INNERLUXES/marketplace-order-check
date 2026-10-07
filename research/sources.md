# Sources

The public pages the documented checks of this tool are based on, each with a short note in this project's own words
on what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so that a point
can be checked against the page it came from, and the copies are the pages' own words, not this project's. src/data.js
holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js is listed
here and has its copy, that no point quotes its page at length, and that the pages say what the documented checks rest
on.

The tool reads an export of NFT marketplace orders and runs nothing; its result is an input to a review of marketplace
orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts
and not a guarantee that an order will fill as intended. These notes say what the pages say so a reader can follow a
finding back to its source. The pages were chosen with web addresses that hold no number that reads like a year, and
each was read with a plain HTTP client as the markdown source in the repository ethereum/ERCs from which
eips.ethereum.org builds the page. No browser was used. The copy of ERC-2981 was read again for this tool and is the
same, byte for byte, as the copy the sibling tool nft-launch-check saved; the copies of ERC-721 and ERC-1155 are the ones
the sibling tool nft-metadata-check saved, copied byte for byte.

## What the pages say, and what they do not

- ERC-2981 is checked against its final text. Its royaltyInfo function takes a token id and a sale price and answers
  with two values: the address that should be sent the royalty, and the royalty amount. The page says that royalty
  amounts are always a percentage of the sale price, that an implementer must work out a percentage of the sale price,
  that the royalty is paid in the same unit as the sale, that the amount may be rounded up or down to a whole number of
  the smallest unit, and that the payment of a royalty must be voluntary, because a move of a token between wallets is
  not always a sale; it leaves the mechanism of payment to later work and to the marketplaces. Its rationale also says
  that a payer of the royalty must pay the amount royaltyInfo stipulates, and that entities that respect the standard
  pay it wherever the sale takes place. It does not speak of basis points, sets no largest royalty, and says nothing of the fee of a marketplace,
  of orders, of listings or of offers. Tests check that the copy holds no mention of basis points or of a marketplace
  fee.
- So `royalty-receiver-mismatch` is documented: royaltyInfo names the address a royalty is sent to, and an order that
  pays its royalty elsewhere does not follow what the contract signals. `royalty-above-declared` is documented: the
  amount royaltyInfo answers is the declared percentage of the sale price, and an order that pays more pays more than
  the contract signals. `royalty-below-declared` leans on the same two points and on the voluntary payment, so it is
  only a note: the page calls the payment voluntary and asks the full amount only of those who respect the standard, so
  whether a marketplace pays less or nothing is its own choice. A royalty less than one smallest unit of a known
  currency away from the declared share is not reported either way, since the page allows that rounding. The file gives
  the declared royalty in basis points, a hundredth of a percent, by the tool's own choice of unit; the page names no
  unit.
- ERC-721 is checked against its final text. Each token is told apart by its id; its transfer functions move one token
  id and take no amount, and the page says that, every token being unique, the quantity a holder has is none or one.
  `erc721-amount-not-one` leans on it: an order for one ERC-721 token id with an amount other than 1, or for 0 tokens,
  asks for what an ERC-721 holder cannot have.
- ERC-1155 is checked against its final text. Its transfer functions move an amount of a token id, and must revert when
  the balance of the holder for that id is lower than the amount sent. `erc1155-amount-above-balance` leans on it: a
  listing for more than the balance of its maker cannot be filled by a compliant contract. The page does not forbid a
  transfer of 0, so `erc1155-amount-invalid` is a best practice of this tool.

Everything else the tool checks is a best practice of this tool, not a rule in these pages, and each check says so in
its message and in its own entry of [docs/rules-and-sources.md](../docs/rules-and-sources.md), with the reason. No page
saved here says how the fees of a marketplace are split or that they must stay below the price, that an order needs an
end or a length, that a price of 0 is a mistake, which currency belongs to which chain, that an offer must be paid in a
wrapped token, that a token must not be listed twice, what form an address has, that a maker may not be its own taker,
or how an offer names a set of tokens with a merkle root. These are the checks an NFT marketplace developer makes on
orders from practice.

The tool reads an export of its own format and was not tied to the page of a marketplace or of an order protocol on
purpose: such pages change often, describe one product, and could not be read as plain text without a browser. Seaport,
an open order format used by several marketplaces, is named in the documents only as an example of a protocol whose
orders a script can turn into the export; no page of it is saved, and no check rests on it.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out, so that no copy holds a date, a number that reads like a year or personal contact
details, and every copy is plain ASCII (decision 1 in docs/decisions):

- ERC-2981: the line `author:` of the front matter, which names the authors with their handles, and the line
  `created:`, which holds the day the page was created. No other line had to be left out or changed.
- ERC-721: the copy of nft-metadata-check, unchanged. It leaves out the line `author:` of the front matter, which names
  the authors with their handles and email addresses; the line `created:`, which holds the day the page was created; the
  sentence on a second event held at a conference, which names the year it was held; the line that opens the list of
  example implementations, which names the month and year of the list; and the reference to that conference, which
  holds its year. Its curly quotes and dashes are written as ASCII quotes and hyphens, and the letter D with a stroke is
  written as D.
- ERC-1155: the copy of nft-metadata-check, unchanged. It leaves out the line `author:` of the front matter, which names
  the authors with their email addresses, and the line `created:`, which holds the day the page was created. Its curly
  quotes and dashes are written as ASCII quotes and hyphens, and a letter with an accent in a sample in Spanish is
  written without it.

The checks of `npm run check` and of test/repo.test.js pass over the rest of the text of the copies as it was read.

## Royalties

### ERC-2981: NFT Royalty Standard

https://eips.ethereum.org/EIPS/eip-2981

Copy: research/sources/eip-2981-nft-royalty-standard.txt

The final standard for signalling a royalty of an NFT to marketplaces: a function royaltyInfo that, for a token and a
sale price, answers with the receiver of the royalty and its amount, worked out as a percentage of the sale price and
paid in the unit of the sale, with payment voluntary and left to the marketplaces. `royalty-receiver-mismatch`,
`royalty-above-declared` and `royalty-below-declared` lean on it.

## Token standards

### ERC-721: Non-Fungible Token Standard

https://eips.ethereum.org/EIPS/eip-721

Copy: research/sources/eip-721-non-fungible-token.txt

The final standard for non-fungible tokens on an EVM chain, in which each token is set apart by its id and moved whole,
one id at a time, so that a holder has none or one of a token. `erc721-amount-not-one` leans on it.

### ERC-1155: Multi Token Standard

https://eips.ethereum.org/EIPS/eip-1155

Copy: research/sources/eip-1155-multi-token.txt

The final standard for a contract of many token types, in which a transfer moves an amount of a token id and reverts
when the holder has less than that amount. `erc1155-amount-above-balance` leans on it.
