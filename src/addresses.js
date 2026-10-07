// The form of an address, the chains the tool knows and the currencies of each. An order export of an ERC-721 or
// ERC-1155 marketplace lives on an EVM chain, where an address is 0x and 40 hex digits. The checksum of mixed case
// (EIP-55) is not checked, and nothing is looked up on a chain. Two addresses are the same wallet when they differ only
// in case. The form, the chains and the currencies are a best practice of the tool (src/rules.js, address-malformed,
// currency-chain-mismatch, offer-in-native-currency): no page is saved for them, and the tables are short on purpose.

const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = /^0x0{40}$/;

export const ADDRESS_FORM = '0x followed by 40 hex digits';

// What is wrong with an address, or null when its form is right. zeroOk is true where the zero address has a meaning of
// its own, such as a taker of zeros for an order anyone may fill.
export function addressProblem(text, zeroOk = false) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (!v.startsWith('0x')) return 'does not start with 0x';
  if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
  if (!EVM.test(v)) return 'holds a character that is not a hex digit';
  if (!zeroOk && EVM_ZERO.test(v)) return 'is the zero address, which no one holds';
  return null;
}

// Whether an address is the zero address.
export const isZeroAddress = (text) => EVM_ZERO.test(text.trim());

// The key two addresses are compared by: in small letters.
export const addressKey = (text) => text.trim().toLowerCase();

// The chains the tool knows, by the name a file gives them in small letters, each with its native currency.
export const CHAINS = { ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH', polygon: 'POL', avalanche: 'AVAX', bnb: 'BNB' };

const ETH_FAMILY = ['ethereum', 'base', 'arbitrum', 'optimism'];
const EVERY_EVM = Object.keys(CHAINS);

// The currencies the tool knows, by their symbol in capitals: the chains on which an order may be priced in them, and
// the decimal places of the token. SOL is known so that it can be reported on an EVM chain.
export const CURRENCIES = {
  ETH: { chains: ETH_FAMILY, decimals: 18 },
  WETH: { chains: [...ETH_FAMILY, 'polygon'], decimals: 18 },
  POL: { chains: ['polygon', 'ethereum'], decimals: 18 },
  MATIC: { chains: ['polygon', 'ethereum'], decimals: 18 },
  WPOL: { chains: ['polygon'], decimals: 18 },
  AVAX: { chains: ['avalanche'], decimals: 18 },
  WAVAX: { chains: ['avalanche'], decimals: 18 },
  BNB: { chains: ['bnb'], decimals: 18 },
  WBNB: { chains: ['bnb'], decimals: 18 },
  APE: { chains: ['ethereum'], decimals: 18 },
  DAI: { chains: [...ETH_FAMILY, 'polygon'], decimals: 18 },
  USDC: { chains: EVERY_EVM, decimals: 6 },
  USDT: { chains: EVERY_EVM, decimals: 6 },
  SOL: { chains: [], decimals: 9 }
};

// A currency the tool knows, by its symbol in any case, or null.
export const currencyOf = (symbol) => (Object.hasOwn(CURRENCIES, symbol.toUpperCase()) ? CURRENCIES[symbol.toUpperCase()] : null);

// Whether a currency is the native currency of a chain, which an offer cannot be paid in.
export const isNative = (symbol, chain) => Object.hasOwn(CHAINS, chain) && CHAINS[chain] === symbol.toUpperCase();
