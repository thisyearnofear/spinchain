import { cre, Report } from "@chainlink/cre-sdk";

/**
 * Biometric Verification Workflow (Chainlink Runtime Environment)
 */

// Initialize Capabilities
// Using Avalanche Fuji Chain Selector: 14767482510784806043n
const evmClient = new cre.capabilities.EVMClient(BigInt("14767482510784806043"));
const confidentialHttp = new cre.capabilities.ConfidentialHTTPClient();

export const handler = async (runtime: any, trigger: any, config: any) => {
  const { requestId, rider, classId, threshold, duration } = trigger.args;

  console.log(`Processing verification for rider ${rider} in class ${classId}`);

  // Fetch Biometric Data (Confidential)
  const telemetryResponse = await confidentialHttp.sendRequest(runtime, {
    request: {
        method: "GET",
        url: `https://api.wearable-provider.com/v1/activity?user=${rider}&class=${classId}`,
        multiHeaders: {
          "Authorization": { values: ["Bearer {{secrets.WEARABLE_API_KEY}}"] }
        }
    }
  }).result();

  // telemetryResponse.body is Uint8Array
  const telemetryData = JSON.parse(new TextDecoder().decode(telemetryResponse.body)) as any[];
  
  let qualifyingMinutes = 0;
  let totalEffort = 0;

  for (const point of telemetryData) {
    if (point.heartRate >= threshold) {
      qualifyingMinutes++;
      totalEffort += point.heartRate + (point.power || 0) * 0.5;
    }
  }

  const verified = qualifyingMinutes >= duration;
  const effortScore = Math.min(1000, Math.floor(totalEffort / telemetryData.length));

  console.log(`Verification result: ${verified}, Score: ${effortScore}`);

  // Submit Report back to BiometricOracle.sol
  // BiometricOracle.sol expects: (bytes32 requestId, bytes32 workflowId, bool verified, uint16 effortScore)
  const reportData = 
    requestId.replace("0x", "") + 
    config.WORKFLOW_ID.replace("0x", "") + 
    (verified ? "01" : "00") + 
    effortScore.toString(16).padStart(4, "0");

  // Convert hex string to base64
  const rawReportBase64 = btoa(
    reportData.match(/.{1,2}/g)!
        .map(byte => String.fromCharCode(parseInt(byte, 16)))
        .join("")
  );

  await evmClient.writeReport(runtime, {
    receiver: config.ORACLE_ADDRESS,
    report: new Report({
        rawReport: rawReportBase64,
        configDigest: btoa("\0".repeat(32)),
        seqNr: "1",
        reportContext: btoa("\0".repeat(32)),
        sigs: []
    })
  }).result();
};
