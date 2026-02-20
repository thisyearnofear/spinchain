// YellowSettlement contract ABI + helpers
// Keep this file small and purely EVM-facing.

export const YELLOW_SETTLEMENT_ABI = [
  {
    type: "function",
    name: "settleChannel",
    inputs: [
      {
        name: "state",
        type: "tuple",
        components: [
          { name: "channelId", type: "bytes32" },
          { name: "rider", type: "address" },
          { name: "instructor", type: "address" },
          { name: "classId", type: "bytes32" },
          { name: "finalReward", type: "uint256" },
          { name: "effortScore", type: "uint16" },
          { name: "riderSignature", type: "bytes" },
          { name: "instructorSignature", type: "bytes" },
          { name: "settled", type: "bool" },
        ],
      },
      {
        name: "updates",
        type: "tuple[]",
        components: [
          { name: "channelId", type: "bytes32" },
          { name: "classId", type: "bytes32" },
          { name: "rider", type: "address" },
          { name: "instructor", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "sequence", type: "uint256" },
          { name: "accumulatedReward", type: "uint256" },
          { name: "heartRate", type: "uint16" },
          { name: "power", type: "uint16" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
