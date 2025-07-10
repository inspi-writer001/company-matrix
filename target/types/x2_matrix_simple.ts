/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/x2_matrix_simple.json`.
 */
export type X2MatrixSimple = {
  "address": "7UTAzxNRp1fS9bBBSyKBmfuCrTE1D2hgBhvPo6MY7Tti",
  "metadata": {
    "name": "x2MatrixSimple",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimLevel2Payment",
      "discriminator": [
        64,
        2,
        175,
        13,
        238,
        206,
        29,
        253
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAccount",
          "writable": true
        },
        {
          "name": "positionRecord"
        }
      ],
      "args": [
        {
          "name": "childPosition",
          "type": "u64"
        },
        {
          "name": "level",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createUser",
      "discriminator": [
        108,
        227,
        130,
        130,
        252,
        109,
        75,
        218
      ],
      "accounts": [
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "companyWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "pifUser",
      "discriminator": [
        110,
        219,
        100,
        225,
        236,
        177,
        191,
        162
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "sponsor",
          "writable": true,
          "signer": true
        },
        {
          "name": "sponsorAccount",
          "writable": true
        },
        {
          "name": "sponsorToken",
          "writable": true
        },
        {
          "name": "downline"
        },
        {
          "name": "downlineAccount",
          "writable": true
        },
        {
          "name": "positionRecord",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "companyToken",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAccount",
          "writable": true
        },
        {
          "name": "globalState"
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "discriminator": [
        163,
        46,
        74,
        168,
        216,
        123,
        133,
        98
      ]
    },
    {
      "name": "positionRecord",
      "discriminator": [
        108,
        204,
        45,
        207,
        168,
        255,
        213,
        158
      ]
    },
    {
      "name": "userAccount",
      "discriminator": [
        211,
        33,
        136,
        16,
        186,
        110,
        242,
        127
      ]
    }
  ],
  "events": [
    {
      "name": "paymentClaimed",
      "discriminator": [
        238,
        86,
        136,
        254,
        229,
        217,
        63,
        80
      ]
    },
    {
      "name": "positionCreated",
      "discriminator": [
        63,
        226,
        54,
        63,
        141,
        22,
        31,
        221
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidLevel",
      "msg": "Invalid level"
    },
    {
      "code": 6001,
      "name": "notActive",
      "msg": "Not active"
    },
    {
      "code": 6002,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6003,
      "name": "needTwoPifs",
      "msg": "Need 2 PIFs to withdraw"
    },
    {
      "code": 6004,
      "name": "notParent",
      "msg": "Not the parent position"
    },
    {
      "code": 6005,
      "name": "notOwner",
      "msg": "Not the owner"
    },
    {
      "code": 6006,
      "name": "notLevel2",
      "msg": "Not a Level 2 placement"
    }
  ],
  "types": [
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "companyWallet",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalPositions",
            "type": {
              "array": [
                "u64",
                6
              ]
            }
          },
          {
            "name": "escrowBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "position",
            "type": "u64"
          },
          {
            "name": "fromChild",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "positionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "level",
            "type": "u8"
          },
          {
            "name": "positionNumber",
            "type": "u64"
          },
          {
            "name": "parentNumber",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "positionRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "level",
            "type": "u8"
          },
          {
            "name": "positionNumber",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "sponsor",
            "type": "pubkey"
          },
          {
            "name": "pifCount",
            "type": "u8"
          },
          {
            "name": "totalEarnings",
            "type": "u64"
          },
          {
            "name": "availableBalance",
            "type": "u64"
          },
          {
            "name": "reserveBalance",
            "type": "u64"
          },
          {
            "name": "positionsCount",
            "type": {
              "array": [
                "u32",
                6
              ]
            }
          }
        ]
      }
    }
  ]
};
