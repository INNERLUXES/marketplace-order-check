// The public pages the documented checks rest on, and the points of each that the reports show, written in this
// project's own words. A page is named by its address; a copy of its text, read before it was listed, is kept under
// research/sources. research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its
// points, and test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended';

export const NOTICE = `This report is an input to a review of marketplace orders before they are signed or filled: ${NOT_A}.`;

export const SOURCES = [
  { id: 'eip-2981', title: 'ERC-2981: NFT Royalty Standard', url: 'https://eips.ethereum.org/EIPS/eip-2981', file: 'research/sources/eip-2981-nft-royalty-standard.txt' },
  { id: 'eip-721', title: 'ERC-721: Non-Fungible Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-721', file: 'research/sources/eip-721-non-fungible-token.txt' },
  { id: 'eip-1155', title: 'ERC-1155: Multi Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-1155', file: 'research/sources/eip-1155-multi-token.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'erc2981-receiver': { source: 'eip-2981', text: 'The royaltyInfo function of ERC-2981 answers a marketplace with two values for a sale: the address the royalty is to be sent to, and the amount.' },
  'erc2981-percentage': { source: 'eip-2981', text: 'Under ERC-2981 the royalty owed on a sale is worked out as a share of the sale price and paid in the unit of the sale; the page speaks of a percentage, and names no unit such as basis points and no largest value.' },
  'erc2981-voluntary': { source: 'eip-2981', text: 'ERC-2981 only lets a contract signal its royalty; the page leaves the payment to the marketplaces and calls it voluntary, since a move of a token between wallets is not always a sale.' },
  'erc721-unique': { source: 'eip-721', text: 'Under ERC-721 each token is set apart from every other by its id, so a holder has none or one of a given token, and the transfer functions move one token id with no amount.' },
  'erc1155-balance': { source: 'eip-1155', text: 'The transfer functions of ERC-1155 move an amount of a token id, and a compliant contract reverts when the holder has less of that id than the amount sent.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
