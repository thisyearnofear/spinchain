import { 
  cre,
  handler, 
  Runner, 
  type Runtime, 
  Report 
} from "@chainlink/cre-sdk";

const { CronCapability, ConfidentialHTTPClient, EVMClient } = cre.capabilities;

export type Config = {
  ORACLE_ADDRESS: string;
  WORKFLOW_ID: string;
};

/**
 * SpinChain Biometric Verification Workflow
 * Triggered by: Cron (every 30s)
 * Logic: Polls BiometricOracle for new VerificationRequested events
 */
export const onCronTrigger = async (
  runtime: Runtime<Config>, 
  trigger: any
): Promise<void> => {
  const config = runtime.config;
  const confidentialHttp = new ConfidentialHTTPClient();
  const evmClient = new EVMClient(BigInt("14767482510784806043")); // Avalanche Fuji

  runtime.log(`Checking for new verification requests at ${config.ORACLE_ADDRESS}`);

  // In this SDK version, we manually fetch logs or data if log trigger is unavailable
  // For the simulation/hackathon, we'll simulate the event processing
  
  // Example: Mocking the detection of a request for simulation purposes
  // In production with a full SDK, this would be an automatic trigger.
  const mockRequest = {
    requestId: "0xa67b3d837023046fb62531155299c6491ed4d7f5d7e1ae48f0878c057183f610",
    rider: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    classId: "0x3d09dda9c8d57f1f22bbf8442f86ced4fd25089fc22a6bce200f9698dfbdf8c5",
    threshold: 150,
    duration: 30
  };

  runtime.log(`Processing verification for rider ${mockRequest.rider}`);

  // 1. Fetch Biometric Data (Confidential)
  const telemetryResponse = await confidentialHttp.sendRequest(runtime, {
    request: {
        method: "GET",
        url: `https://api.wearable-provider.com/v1/activity?user=${mockRequest.rider}&class=${mockRequest.classId}`,
        multiHeaders: {
          "Authorization": { values: ["Bearer {{secrets.WEARABLE_API_KEY}}"] }
        }
    }
  }).result();

  const telemetryData = JSON.parse(new TextDecoder().decode(telemetryResponse.body)) as any[];
  
  let qualifyingMinutes = 0;
  let totalEffort = 0;

  for (const point of telemetryData) {
    if (point.heartRate >= mockRequest.threshold) {
      qualifyingMinutes++;
      totalEffort += point.heartRate + (point.power || 0) * 0.5;
    }
  }

  const verified = qualifyingMinutes >= mockRequest.duration;
  const effortScore = Math.min(1000, Math.floor(totalEffort / telemetryData.length));

  runtime.log(`Verification result: ${verified}, Score: ${effortScore}`);

  // 2. Submit Report back to BiometricOracle.sol
  const reportData = 
    mockRequest.requestId.replace("0x", "") + 
    config.WORKFLOW_ID.replace("0x", "") + 
    (verified ? "01" : "00") + 
    effortScore.toString(16).padStart(4, "0");

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

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();

  return [
    handler(
      cron.trigger({ schedule: "*/30 * * * * *" }),
      onCronTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
