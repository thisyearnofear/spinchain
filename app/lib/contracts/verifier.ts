// Contract ABIs for ZK Verifiers
// Single source of truth for contract interfaces

export const EFFORT_THRESHOLD_VERIFIER_ADDRESS = process.env
  .NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS as `0x${string}` || '0x0';

export const EFFORT_THRESHOLD_VERIFIER_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_noirVerifier', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'InvalidProof',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPublicInputs',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ProofAlreadyUsed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ThresholdNotMet',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'proofHash', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'rider', type: 'address' },
      { indexed: true, internalType: 'bytes32', name: 'classId', type: 'bytes32' },
      { indexed: false, internalType: 'uint16', name: 'effortScore', type: 'uint16' },
      { indexed: false, internalType: 'uint32', name: 'secondsAbove', type: 'uint32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'ProofVerified',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
      { internalType: 'bytes32[]', name: 'publicInputs', type: 'bytes32[]' },
    ],
    name: 'verifyAndRecord',
    outputs: [{ internalType: 'uint16', name: 'effortScore', type: 'uint16' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
      { internalType: 'bytes32[]', name: 'publicInputs', type: 'bytes32[]' },
    ],
    name: 'verifyProof',
    outputs: [{ internalType: 'bool', name: 'success', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint16', name: 'threshold', type: 'uint16' },
      { internalType: 'uint32', name: 'minDuration', type: 'uint32' },
      { internalType: 'bool', name: 'thresholdMet', type: 'bool' },
      { internalType: 'uint32', name: 'secondsAbove', type: 'uint32' },
      { internalType: 'uint16', name: 'effortScore', type: 'uint16' },
      { internalType: 'bytes32', name: 'classId', type: 'bytes32' },
      { internalType: 'address', name: 'rider', type: 'address' },
    ],
    name: 'encodePublicInputs',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'proofHash', type: 'bytes32' }],
    name: 'isProofUsed',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'noirVerifier',
    outputs: [{ internalType: 'contract IUltraVerifier', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
