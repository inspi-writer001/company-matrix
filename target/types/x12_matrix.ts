/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/x12_matrix.json`.
 */
export type X12Matrix = {
  "address": "2x2nGb9og4nGz3Hu4KCLAF84buDYmk5aEktkDSV95vpw",
  "metadata": {
    "name": "x12Matrix",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "activateWealthyClub",
      "discriminator": [
        239,
        205,
        187,
        5,
        23,
        161,
        200,
        76
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
          "name": "wealthyClubAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  97,
                  108,
                  116,
                  104,
                  121,
                  95,
                  99,
                  108,
                  117,
                  98
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
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sponsor",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
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
      "name": "getMatrixStructure",
      "discriminator": [
        196,
        98,
        102,
        75,
        94,
        188,
        185,
        246
      ],
      "accounts": [
        {
          "name": "globalState"
        }
      ],
      "args": [
        {
          "name": "level",
          "type": "u8"
        },
        {
          "name": "startPosition",
          "type": "u64"
        },
        {
          "name": "count",
          "type": "u8"
        }
      ],
      "returns": {
        "vec": {
          "defined": {
            "name": "positionInfo"
          }
        }
      }
    },
    {
      "name": "getUserPositions",
      "discriminator": [
        93,
        107,
        21,
        26,
        85,
        200,
        212,
        216
      ],
      "accounts": [
        {
          "name": "userAccount"
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "pubkey"
        }
      ],
      "returns": {
        "defined": {
          "name": "userPositionsSummary"
        }
      }
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
      "name": "processDiamondCompletionWithChain",
      "discriminator": [
        32,
        224,
        55,
        144,
        129,
        107,
        199,
        227
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
          "name": "userWealthyClub"
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
        }
      ],
      "args": []
    },
    {
      "name": "purchaseAllInMatrixSimple",
      "discriminator": [
        46,
        212,
        40,
        213,
        9,
        115,
        127,
        42
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
        }
      ],
      "args": []
    },
    {
      "name": "purchaseLevelWithDistribution",
      "discriminator": [
        190,
        241,
        228,
        223,
        191,
        71,
        43,
        148
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
      "args": [
        {
          "name": "level",
          "type": "u8"
        },
        {
          "name": "downline",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "purchaseMultiplePositions",
      "discriminator": [
        139,
        48,
        163,
        41,
        55,
        186,
        84,
        198
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
      "args": [
        {
          "name": "level",
          "type": "u8"
        },
        {
          "name": "quantity",
          "type": "u8"
        },
        {
          "name": "downline",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "purchaseWealthyClubAllInSimple",
      "discriminator": [
        60,
        67,
        149,
        230,
        242,
        121,
        196,
        91
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
          "name": "wealthyClubAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  101,
                  97,
                  108,
                  116,
                  104,
                  121,
                  95,
                  99,
                  108,
                  117,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "downline"
              }
            ]
          }
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
    },
    {
      "name": "wealthyClubAccount",
      "discriminator": [
        141,
        27,
        29,
        60,
        21,
        237,
        227,
        130
      ]
    }
  ],
  "events": [
    {
      "name": "comboPackagePurchased",
      "discriminator": [
        212,
        204,
        222,
        35,
        147,
        229,
        198,
        84
      ]
    },
    {
      "name": "diamondCompleted",
      "discriminator": [
        105,
        100,
        10,
        255,
        248,
        28,
        247,
        28
      ]
    },
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
    },
    {
      "name": "wealthyClubActivated",
      "discriminator": [
        251,
        180,
        60,
        12,
        148,
        175,
        90,
        132
      ]
    },
    {
      "name": "wealthyClubPayment",
      "discriminator": [
        19,
        160,
        150,
        204,
        231,
        208,
        237,
        15
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
      "name": "alreadyActive",
      "msg": "Already active"
    },
    {
      "code": 6003,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6004,
      "name": "needTwoPifs",
      "msg": "Need 2 PIFs to withdraw"
    },
    {
      "code": 6005,
      "name": "notParent",
      "msg": "Not the parent position"
    },
    {
      "code": 6006,
      "name": "notOwner",
      "msg": "Not the owner"
    },
    {
      "code": 6007,
      "name": "notLevel2",
      "msg": "Not a Level 2 placement"
    },
    {
      "code": 6008,
      "name": "alreadyActivated",
      "msg": "Already activated"
    },
    {
      "code": 6009,
      "name": "wealthyClubNotActivated",
      "msg": "Wealthy Club not activated"
    },
    {
      "code": 6010,
      "name": "alreadyPurchased",
      "msg": "Combo package already purchased"
    },
    {
      "code": 6011,
      "name": "invalidQuantity",
      "msg": "Invalid quantity"
    },
    {
      "code": 6012,
      "name": "matrixFull",
      "msg": "Matrix is full"
    },
    {
      "code": 6013,
      "name": "selfRegister",
      "msg": "Cannot register yourself"
    }
  ],
  "types": [
    {
      "name": "comboPackagePurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "packageType",
            "type": "string"
          },
          {
            "name": "totalCost",
            "type": "u64"
          },
          {
            "name": "levelsPurchased",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "diamondCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "reEntriesCreated",
            "type": "u32"
          },
          {
            "name": "wealthyClubPayment",
            "type": "u64"
          }
        ]
      }
    },
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
          },
          {
            "name": "wealthyClubTotalMembers",
            "type": "u64"
          },
          {
            "name": "wealthyClubActiveMembers",
            "type": "u64"
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
      "name": "positionInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionNumber",
            "type": "u64"
          },
          {
            "name": "parentPosition",
            "type": "u64"
          },
          {
            "name": "leftChild",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "rightChild",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "isComplete",
            "type": "bool"
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
          },
          {
            "name": "hasAllInCombo",
            "type": "bool"
          },
          {
            "name": "hasWealthyClubCombo",
            "type": "bool"
          },
          {
            "name": "comboLevelsUsed",
            "type": {
              "array": [
                "bool",
                6
              ]
            }
          }
        ]
      }
    },
    {
      "name": "userPositionsSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "silverPositions",
            "type": "u32"
          },
          {
            "name": "goldPositions",
            "type": "u32"
          },
          {
            "name": "sapphirePositions",
            "type": "u32"
          },
          {
            "name": "emeraldPositions",
            "type": "u32"
          },
          {
            "name": "platinumPositions",
            "type": "u32"
          },
          {
            "name": "diamondPositions",
            "type": "u32"
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
            "name": "isWealthyClubActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "wealthyClubAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "sponsor",
            "type": "pubkey"
          },
          {
            "name": "activatedSponsor",
            "type": "pubkey"
          },
          {
            "name": "isActivated",
            "type": "bool"
          },
          {
            "name": "positionNumber",
            "type": "u64"
          },
          {
            "name": "totalEarned",
            "type": "u64"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "wealthyClubActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "positionNumber",
            "type": "u64"
          },
          {
            "name": "activatedSponsor",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "wealthyClubPayment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "level",
            "type": "u8"
          },
          {
            "name": "fromUser",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
