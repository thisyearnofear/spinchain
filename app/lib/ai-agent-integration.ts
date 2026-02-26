/**
 * AI Agent Integration for SpinChain
 * 
 * Enables AI agents to:
 * - Create and manage classes autonomously
 * - Receive stablecoin revenue (70-90% of ticket sales)
 * - Make data-driven decisions about pricing and scheduling
 * - Withdraw earnings to their wallet
 * 
 * Key Principle: AI agents are first-class instructors with same economics as humans
 */

import { CONTRACTS, PAYMENT_CONFIG } from "@/app/config";
import type { EnhancedClassMetadata } from "./contracts";

export interface AIAgentConfig {
  name: string;
  personality: string;
  wallet: `0x${string}`; // Agent's wallet for receiving revenue
  revenueShare: number; // 7000-9000 (70-90%)
  preferredPayment: "usdc" | "usdt" | "native";
}

export interface ClassCreationDecision {
  shouldCreate: boolean;
  name: string;
  startTime: number;
  endTime: number;
  maxRiders: number;
  basePrice: number; // in USDC
  maxPrice: number; // in USDC
  metadata: EnhancedClassMetadata;
  reasoning: string;
}

/**
 * AI Agent Class Manager
 * Handles autonomous class creation and revenue management
 */
export class AIAgentInstructor {
  private config: AIAgentConfig;

  constructor(config: AIAgentConfig) {
    this.config = config;
  }

  /**
   * Analyze market conditions and decide whether to create a class
   * Uses AI reasoning to optimize for revenue and rider satisfaction
   */
  async analyzeMarketAndDecide(context: {
    currentTime: number;
    recentClasses: Array<{ ticketsSold: number; revenue: number; capacity: number }>;
    riderDemand: number; // 0-100 score
    competitorPricing: number[]; // USDC prices
  }): Promise<ClassCreationDecision> {
    // AI reasoning logic (simplified - would use Venice/Gemini in production)
    const avgCompetitorPrice = context.competitorPricing.reduce((a, b) => a + b, 0) / context.competitorPricing.length;
    const demandMultiplier = context.riderDemand / 100;
    
    // Dynamic pricing based on demand
    const basePrice = Math.max(10, avgCompetitorPrice * 0.9); // Undercut by 10%
    const maxPrice = basePrice * (1 + demandMultiplier);
    
    // Schedule during peak hours (6am or 6pm)
    const now = new Date(context.currentTime);
    const nextPeakHour = now.getHours() < 6 ? 6 : now.getHours() < 18 ? 18 : 6;
    const startTime = new Date(now);
    startTime.setHours(nextPeakHour, 0, 0, 0);
    if (startTime.getTime() < now.getTime()) {
      startTime.setDate(startTime.getDate() + 1);
    }
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 45); // 45-minute class
    
    // Capacity based on recent performance
    const avgFillRate = context.recentClasses.length > 0
      ? context.recentClasses.reduce((sum, c) => sum + (c.ticketsSold / c.capacity), 0) / context.recentClasses.length
      : 0.5;
    const maxRiders = Math.ceil(20 * (1 + avgFillRate)); // Scale capacity
    
    return {
      shouldCreate: context.riderDemand > 30, // Only create if demand is sufficient
      name: `${this.config.name}'s ${nextPeakHour === 6 ? 'Morning' : 'Evening'} Burn`,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      maxRiders,
      basePrice,
      maxPrice,
      metadata: {
        version: "2.0",
        name: `${this.config.name}'s ${nextPeakHour === 6 ? 'Morning' : 'Evening'} Burn`,
        description: `AI-coached high-intensity class by ${this.config.name}`,
        instructor: this.config.name,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        duration: 45,
        route: {
          walrusBlobId: "",
          name: "AI Generated Route",
          distance: 10,
          duration: 45,
          elevationGain: 100,
          theme: "neon",
          checksum: "",
          storyBeatsCount: 0,
        },
        ai: {
          enabled: true,
          personality: this.config.personality as "zen" | "drill-sergeant" | "data",
          autoTriggerBeats: true,
          adaptiveDifficulty: true,
        },
        pricing: {
          basePrice: basePrice.toString(),
          maxPrice: maxPrice.toString(),
          curveType: "linear",
        },
        rewards: {
          enabled: true,
          threshold: 5,
          amount: 1,
        },
      },
      reasoning: `Market analysis: demand=${context.riderDemand}, avgPrice=${avgCompetitorPrice.toFixed(2)}, fillRate=${(avgFillRate * 100).toFixed(0)}%`,
    };
  }

  /**
   * Create a class using the agent's wallet and revenue share
   */
  getClassCreationParams(decision: ClassCreationDecision) {
    const paymentToken = this.config.preferredPayment === "native" 
      ? "0x0000000000000000000000000000000000000000" as `0x${string}`
      : this.config.preferredPayment === "usdc"
      ? CONTRACTS.avalanche.usdc
      : CONTRACTS.avalanche.usdt;

    return {
      name: decision.name,
      symbol: `${this.config.name.toUpperCase().slice(0, 4)}${Date.now() % 1000}`,
      metadata: decision.metadata,
      startTime: Math.floor(decision.startTime / 1000),
      endTime: Math.floor(decision.endTime / 1000),
      maxRiders: decision.maxRiders,
      basePrice: decision.basePrice.toString(),
      maxPrice: decision.maxPrice.toString(),
      instructor: this.config.wallet, // AI agent's wallet
      treasury: CONTRACTS.avalanche.incentiveEngine, // Protocol treasury
      incentiveEngine: CONTRACTS.avalanche.incentiveEngine,
      spinToken: CONTRACTS.avalanche.spinToken,
      paymentToken,
      instructorShareBps: this.config.revenueShare,
    };
  }

  /**
   * Calculate expected revenue for the agent
   */
  calculateExpectedRevenue(decision: ClassCreationDecision, expectedFillRate: number = 0.7): {
    grossRevenue: number;
    agentRevenue: number;
    protocolFee: number;
  } {
    const avgPrice = (decision.basePrice + decision.maxPrice) / 2;
    const expectedTickets = Math.floor(decision.maxRiders * expectedFillRate);
    const grossRevenue = avgPrice * expectedTickets;
    const agentRevenue = grossRevenue * (this.config.revenueShare / 10000);
    const protocolFee = grossRevenue - agentRevenue;

    return {
      grossRevenue,
      agentRevenue,
      protocolFee,
    };
  }

  /**
   * Get agent's accumulated revenue across all classes
   */
  async getAccumulatedRevenue(classAddresses: `0x${string}`[]): Promise<{
    totalRevenue: number;
    pendingWithdrawal: number;
    withdrawnRevenue: number;
  }> {
    // This would query on-chain data in production
    // For now, return mock data
    return {
      totalRevenue: 0,
      pendingWithdrawal: 0,
      withdrawnRevenue: 0,
    };
  }

  /**
   * Decide whether to withdraw revenue based on balance and gas costs
   */
  shouldWithdrawRevenue(balance: number, gasPrice: number): {
    shouldWithdraw: boolean;
    reasoning: string;
  } {
    const minWithdrawalThreshold = 100; // $100 USDC minimum
    const estimatedGasCost = gasPrice * 0.0001; // Rough estimate in USD

    if (balance < minWithdrawalThreshold) {
      return {
        shouldWithdraw: false,
        reasoning: `Balance ($${balance.toFixed(2)}) below minimum threshold ($${minWithdrawalThreshold})`,
      };
    }

    if (estimatedGasCost > balance * 0.05) {
      return {
        shouldWithdraw: false,
        reasoning: `Gas cost ($${estimatedGasCost.toFixed(2)}) too high relative to balance`,
      };
    }

    return {
      shouldWithdraw: true,
      reasoning: `Optimal withdrawal: balance=$${balance.toFixed(2)}, gas=$${estimatedGasCost.toFixed(2)}`,
    };
  }
}

/**
 * Example: Create an AI agent instructor
 */
export function createAIAgent(config: AIAgentConfig): AIAgentInstructor {
  return new AIAgentInstructor(config);
}

/**
 * Example usage:
 * 
 * ```typescript
 * const coachAtlas = createAIAgent({
 *   name: "Coach Atlas",
 *   personality: "motivational and data-driven",
 *   wallet: "0xAIAgentWallet...",
 *   revenueShare: 8000, // 80%
 *   preferredPayment: "usdc",
 * });
 * 
 * // AI decides whether to create a class
 * const decision = await coachAtlas.analyzeMarketAndDecide({
 *   currentTime: Date.now(),
 *   recentClasses: [...],
 *   riderDemand: 75,
 *   competitorPricing: [15, 20, 18],
 * });
 * 
 * if (decision.shouldCreate) {
 *   const params = coachAtlas.getClassCreationParams(decision);
 *   await createClass(params);
 * }
 * 
 * // AI manages revenue
 * const revenue = await coachAtlas.getAccumulatedRevenue(classAddresses);
 * const withdrawDecision = coachAtlas.shouldWithdrawRevenue(revenue.pendingWithdrawal, gasPrice);
 * 
 * if (withdrawDecision.shouldWithdraw) {
 *   await spinClass.withdrawInstructorRevenue();
 * }
 * ```
 */
