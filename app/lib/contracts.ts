export const CLASS_FACTORY_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual
export const INCENTIVE_ENGINE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual
export const SPIN_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual

export const CLASS_FACTORY_ABI = [
    {
        "type": "function",
        "name": "createClass",
        "inputs": [
            { "name": "name", "type": "string" },
            { "name": "symbol", "type": "string" },
            { "name": "classMetadata", "type": "string" },
            { "name": "startTime", "type": "uint256" },
            { "name": "endTime", "type": "uint256" },
            { "name": "maxRiders", "type": "uint256" },
            { "name": "basePrice", "type": "uint256" },
            { "name": "maxPrice", "type": "uint256" },
            { "name": "treasury", "type": "address" },
            { "name": "incentiveEngine", "type": "address" }
        ],
        "outputs": [{ "name": "spinClass", "type": "address" }],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "ClassCreated",
        "inputs": [
            { "indexed": true, "name": "instructor", "type": "address" },
            { "indexed": true, "name": "spinClass", "type": "address" },
            { "indexed": true, "name": "classId", "type": "bytes32" },
            { "name": "startTime", "type": "uint256" },
            { "name": "endTime", "type": "uint256" },
            { "name": "maxRiders", "type": "uint256" }
        ]
    }
] as const;

export const SPIN_CLASS_ABI = [
    {
        "type": "function",
        "name": "purchaseTicket",
        "inputs": [],
        "outputs": [{ "name": "tokenId", "type": "uint256" }],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "checkIn",
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "currentPrice",
        "inputs": [],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "ticketsSold",
        "inputs": [],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "attended",
        "inputs": [{ "name": "", "type": "address" }],
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "settleRevenue",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
] as const;

export const INCENTIVE_ENGINE_ABI = [
    {
        "type": "function",
        "name": "submitAttestation",
        "inputs": [
            { "name": "spinClass", "type": "address" },
            { "name": "rider", "type": "address" },
            { "name": "rewardAmount", "type": "uint256" },
            { "name": "classId", "type": "bytes32" },
            { "name": "claimHash", "type": "bytes32" },
            { "name": "timestamp", "type": "uint256" },
            { "name": "signature", "type": "bytes" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
] as const;
