# marketplace-order-check: examples/good/orders.json

- File: examples/good/orders.json \(JSON, 15 lines, 2,882 bytes\)
- Chain: ethereum
- Collections: 2: Harbor Example Owls, ERC-721, royalty 500 basis points \(5%\) to 0x9999999999999999999999999999999999999999; Meadow Example Badges, ERC-1155, royalty 250 basis points \(2.5%\) to 0x8888888888888888888888888888888888888888
- Orders: 5 \(3 listings, 2 offers\)
- Now: unix second 1800000000, from --now
- Max expiry: 180 days
- Findings: 0
- Result: **PASS - no finding at or above error**

## Findings

None.

## Orders (5)

| Order | Side | Collection | Token | Amount | Price | Fees | Seller gets |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| L1 | listing | Harbor Example Owls | \#7 | 1 | 1.5 ETH | 0.1125 ETH | 1.3875 ETH |
| L2 | listing | Meadow Example Badges | \#3 | 2 | 40 USDC | 2 USDC | 38 USDC |
| O1 | offer | Harbor Example Owls | \#9 | - | 0.8 WETH | 0.06 WETH | 0.74 WETH |
| O2 | offer | Harbor Example Owls | by root | 3 | 0.5 WETH | 0.025 WETH | 0.475 WETH |
| T1 | listing | Harbor Example Owls | \#11 | - | transfer | 0 | - |

This report is an input to a review of marketplace orders before they are signed or filled: not legal or financial advice, not an audit of the marketplace or its contracts and not a guarantee that an order will fill as intended.
