// Single source of truth for all error mapping
// DRY: All error handling logic centralized

export type ErrorCategory = 
  | 'USER_REJECTED'
  | 'INSUFFICIENT_FUNDS'
  | 'ALREADY_PROCESSING'
  | 'WALLET_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SALE_NOT_ACTIVE'
  | 'SOLD_OUT'
  | 'ALREADY_CLAIMED'
  | 'INVALID_PROOF'
  | 'GAS_ESTIMATION'
  | 'UNKNOWN';

export interface ErrorDetails {
  category: ErrorCategory;
  title: string;
  message: string;
  isRecoverable: boolean;
}

function categorizeError(error: Error): ErrorCategory {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('user rejected') || msg.includes('rejected the request')) return 'USER_REJECTED';
  if (msg.includes('insufficient funds')) return 'INSUFFICIENT_FUNDS';
  if (msg.includes('already processing') || msg.includes('request of type')) return 'ALREADY_PROCESSING';
  if (msg.includes('wallet') && (msg.includes('not found') || msg.includes('not installed'))) return 'WALLET_NOT_FOUND';
  if (msg.includes('network') || msg.includes('chain')) return 'NETWORK_ERROR';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('sale not active')) return 'SALE_NOT_ACTIVE';
  if (msg.includes('sold out')) return 'SOLD_OUT';
  if (msg.includes('already claimed')) return 'ALREADY_CLAIMED';
  if (msg.includes('invalid proof')) return 'INVALID_PROOF';
  if (msg.includes('gas') || msg.includes('estimate')) return 'GAS_ESTIMATION';
  
  return 'UNKNOWN';
}

const ERROR_MESSAGES: Record<ErrorCategory, Omit<ErrorDetails, 'category'>> = {
  USER_REJECTED: {
    title: 'Transaction Cancelled',
    message: 'You declined the transaction in your wallet.',
    isRecoverable: true,
  },
  INSUFFICIENT_FUNDS: {
    title: 'Insufficient Funds',
    message: 'You don\'t have enough AVAX to cover this transaction.',
    isRecoverable: false,
  },
  ALREADY_PROCESSING: {
    title: 'Request Pending',
    message: 'Please check your wallet - there\'s already a request waiting.',
    isRecoverable: true,
  },
  WALLET_NOT_FOUND: {
    title: 'Wallet Not Found',
    message: 'No compatible wallet detected. Please install MetaMask or Rabby.',
    isRecoverable: false,
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Connection problem. Please check your network and try again.',
    isRecoverable: true,
  },
  TIMEOUT: {
    title: 'Connection Timeout',
    message: 'The connection took too long. Please try again.',
    isRecoverable: true,
  },
  SALE_NOT_ACTIVE: {
    title: 'Sale Not Active',
    message: 'Ticket sales haven\'t started yet for this class.',
    isRecoverable: false,
  },
  SOLD_OUT: {
    title: 'Sold Out',
    message: 'This class is fully booked.',
    isRecoverable: false,
  },
  ALREADY_CLAIMED: {
    title: 'Already Claimed',
    message: 'You\'ve already claimed rewards for this class.',
    isRecoverable: false,
  },
  INVALID_PROOF: {
    title: 'Invalid Proof',
    message: 'Your effort proof couldn\'t be verified.',
    isRecoverable: false,
  },
  GAS_ESTIMATION: {
    title: 'Gas Estimation Failed',
    message: 'The transaction may fail or the contract may be paused.',
    isRecoverable: true,
  },
  UNKNOWN: {
    title: 'Transaction Failed',
    message: 'Something went wrong. Please try again.',
    isRecoverable: true,
  },
};

export function parseError(error: unknown): ErrorDetails {
  const err = error instanceof Error ? error : new Error(String(error));
  const category = categorizeError(err);
  
  return {
    category,
    ...ERROR_MESSAGES[category],
  };
}

// Hook-specific error context
export const CONTRACT_ERROR_CONTEXT = {
  createClass: {
    INSUFFICIENT_FUNDS: {
      title: 'Insufficient AVAX',
      message: 'You need more AVAX to deploy a class contract.',
    },
  },
  purchaseTicket: {
    INSUFFICIENT_FUNDS: {
      title: 'Insufficient AVAX',
      message: 'You need more AVAX to purchase this ticket.',
    },
  },
  claimReward: {
    // Uses defaults
  },
} as const;
